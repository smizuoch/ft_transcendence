import fastify from 'fastify';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MediasoupService } from './mediasoup-service';
import { RoomManager } from './room-manager';
import { TournamentManager } from './tournament-manager';
import { GameState, PlayerInfo } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

// 型定義の問題回避
declare const process: any;
declare const require: any;

// デバッグログ用のヘルパー関数
const isDebugMode = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

const debugLog = (message: string) => {
  if (isDebugMode) {
    console.log(`[DEBUG] ${message}`);
  }
};

const errorLog = (message: string) => {
  console.error(`[ERROR] ${message}`);
};

const warnLog = (message: string) => {
  console.warn(`[WARN] ${message}`);
};

// JWT認証機能
interface JWTPayload {
  username: string;
  userId?: string;
  iat?: number;
  exp?: number;
}

// ユーザープロフィール取得機能（Node.js標準のhttpモジュールを使用）
const fetchUserProfile = async (username: string): Promise<PlayerInfo> => {
  return new Promise((resolve) => {
    const http = require('http');
    
    const options = {
      hostname: 'user_search',
      port: 3000,
      path: `/api/user-search/profile/${username}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res: any) => {
      let data = '';
      
      res.on('data', (chunk: any) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const result = JSON.parse(data);
            const userData = result.data;
            
            resolve({
              id: userData.username,
              avatar: userData.profileImage || "/images/avatar/default_avatar.png",
              name: userData.username
            });
          } else {
            errorLog(`Failed to fetch profile for ${username}, status: ${res.statusCode}`);
            resolve({
              id: username,
              avatar: "/images/avatar/default_avatar.png",
              name: username
            });
          }
        } catch (error) {
          errorLog(`Error parsing response for ${username}: ${error}`);
          resolve({
            id: username,
            avatar: "/images/avatar/default_avatar.png",
            name: username
          });
        }
      });
    });

    req.on('error', (error: any) => {
      errorLog(`Error fetching profile for ${username}: ${error}`);
      resolve({
        id: username,
        avatar: "/images/avatar/default_avatar.png",
        name: username
      });
    });

    req.end();
  });
};

// JWTトークンからユーザー名を抽出
const extractUsernameFromToken = (token: string): string | null => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded?.username || null;
  } catch (error) {
    errorLog(`Error decoding JWT token: ${error}`);
    return null;
  }
};

// SSL証明書の設定
const getSSLOptions = () => {
  const certDirs = ['/app/internal-certs', '/app/certs', '/certs', './certs'];
  
  debugLog('=== SSL Certificate Debug ===');
  
  for (const certDir of certDirs) {
    debugLog(`Checking certificate directory: ${certDir}`);
    
    // 証明書ディレクトリの存在確認
    if (!fs.existsSync(certDir)) {
      debugLog(`Certificate directory does not exist: ${certDir}`);
      continue;
    }
    
    // ディレクトリの内容を表示
    try {
      const files = fs.readdirSync(certDir);
      debugLog(`Files in certificate directory: ${files}`);
      
      // 共通証明書のパス
      const keyPath = path.join(certDir, 'server.key');
      const certPath = path.join(certDir, 'server.crt');
      
      debugLog('Checking certificate paths:');
      debugLog(`- Common key: ${keyPath}, exists: ${fs.existsSync(keyPath)}`);
      debugLog(`- Common cert: ${certPath}, exists: ${fs.existsSync(certPath)}`);
      
      // まず共通証明書を試す
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        debugLog(`Using common SSL certificates from: ${certDir}`);
        const keyContent = fs.readFileSync(keyPath);
        const certContent = fs.readFileSync(certPath);
        debugLog('Successfully read common SSL certificates');
        debugLog(`Key size: ${keyContent.length} bytes`);
        debugLog(`Cert size: ${certContent.length} bytes`);
        debugLog('=== End SSL Certificate Debug ===');
        return {
          key: keyContent,
          cert: certContent
        };
      }
      
    } catch (error) {
      debugLog(`Error accessing certificate directory ${certDir}: ${error}`);
      continue;
    }
  }
  
  errorLog('No valid SSL certificate files found in any directory');
  
  // 自己署名証明書を生成
  debugLog('Generating self-signed certificate...');
  try {
    const { execSync } = require('child_process');
    const tempCertDir = '/tmp/ssl-certs';
    
    // 一時ディレクトリを作成
    if (!fs.existsSync(tempCertDir)) {
      fs.mkdirSync(tempCertDir, { recursive: true });
    }
    
    const keyPath = path.join(tempCertDir, 'server.key');
    const certPath = path.join(tempCertDir, 'server.crt');
    
    // 自己署名証明書を生成
    const cmd = `openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/C=JP/ST=Tokyo/L=Tokyo/O=42Tokyo/OU=ft_transcendence/CN=localhost" -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:0.0.0.0,IP:10.16.2.9"`;
    
    execSync(cmd);
    
    const keyContent = fs.readFileSync(keyPath);
    const certContent = fs.readFileSync(certPath);
    
    debugLog('Generated self-signed certificate');
    debugLog(`Key size: ${keyContent.length} bytes`);
    debugLog(`Cert size: ${certContent.length} bytes`);
    debugLog('=== End SSL Certificate Debug ===');
    
    return {
      key: keyContent,
      cert: certContent
    };
  } catch (error: any) {
    errorLog(`Error generating self-signed certificate: ${error?.message || error}`);
  }
  
  debugLog('=== End SSL Certificate Debug ===');
  return null;
};

const sslOptions = getSSLOptions();

debugLog('=== SFU Server Configuration ===');
debugLog(`SSL Options available: ${!!sslOptions}`);

// SSL証明書が必須なのでHTTPS/WSSを強制
if (!sslOptions) {
  errorLog('❌ SSL certificates are required for HTTPS/WSS operation');
  errorLog('Cannot start server without valid SSL certificates');
  errorLog('SFU servers must use HTTPS/WSS for WebRTC functionality');
  process.exit(1);
}

debugLog('✅ SSL certificates loaded successfully');
debugLog('🔒 Server will run with HTTPS/WSS (required for WebRTC)');

const app = fastify({ 
  logger: true, // シンプルなロガー
  https: sslOptions // HTTPS強制
});

// CORSの設定 - 全世界からのアクセスを許可
// Fastify CORS設定
app.register(require('@fastify/cors'), {
  origin: true, // 全てのオリジンを許可
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Socket.IOサーバーの設定（HTTPS/WSS強制）
const io = new SocketIOServer({
  cors: {
    origin: true, // 全てのオリジンを許可
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket'], // WebSocketのみ使用（polling無効化）
  allowEIO3: false, // 最新のEngine.IOのみ使用
  serveClient: false, // クライアントファイル配信無効
  pingTimeout: 60000,
  pingInterval: 25000
});

// MediasoupとRoomManagerとTournamentManagerのインスタンス
const mediasoupService = new MediasoupService();
const roomManager = new RoomManager();
const tournamentManager = new TournamentManager();

async function startServer() {
  try {
    // Mediasoupワーカーを初期化
    await mediasoupService.initialize();
    debugLog('Mediasoup service initialized');
    debugLog('Starting Socket.IO event handlers...');

    // Socket.IOイベントハンドラー（シグナリングのみ）
    io.on('connection', (socket) => {
      debugLog(`Client connected for signaling: ${socket.id}`);
      debugLog(`Total connected clients: ${io.sockets.sockets.size}`);

      // 接続時にルーターのRTPCapabilitiesを送信
      socket.emit('connection-confirmed', {
        message: 'Successfully connected to SFU server for signaling',
        serverId: socket.id,
        routerRtpCapabilities: mediasoupService.getRouterCapabilities()
      });

      // WebRTCトランスポート作成要求
      socket.on('createWebRtcTransport', async () => {
        try {
          debugLog(`Creating WebRTC transport for ${socket.id}`);
          const transport = await mediasoupService.createWebRtcTransport(socket.id);
          socket.emit('webRtcTransportCreated', transport);
        } catch (error) {
          errorLog(`Failed to create WebRTC transport for ${socket.id}: ${error}`);
          socket.emit('error', { message: 'Failed to create WebRTC transport' });
        }
      });

      // WebRTCトランスポート接続
      socket.on('connectWebRtcTransport', async (data: { dtlsParameters: any }) => {
        try {
          debugLog(`Connecting WebRTC transport for ${socket.id}`);
          await mediasoupService.connectTransport(socket.id, data.dtlsParameters);
          socket.emit('webRtcTransportConnected');
        } catch (error) {
          errorLog(`Failed to connect WebRTC transport for ${socket.id}: ${error}`);
          socket.emit('error', { message: 'Failed to connect WebRTC transport' });
        }
      });

      // データプロデューサー作成（ゲームデータ送信用）
      socket.on('createDataProducer', async (data: { 
        sctpStreamParameters: any; 
        label?: string; 
        protocol?: string; 
        appData?: any 
      }) => {
        try {
          debugLog(`[DATA-PRODUCER] Creating data producer for ${socket.id}`);
          const result = await mediasoupService.createDataProducer(
            socket.id, 
            data.sctpStreamParameters,
            data.label || 'gameData',
            data.protocol || 'gameProtocol',
            data.appData || {}
          );
          debugLog(`[DATA-PRODUCER] ✅ Data producer created for ${socket.id}: ${result.id}`);
          socket.emit('dataProducerCreated', result);
        } catch (error) {
          errorLog(`[DATA-PRODUCER] ❌ Failed to create data producer for ${socket.id}: ${error}`);
          socket.emit('dataProducerCreationFailed', { 
            message: error instanceof Error ? error.message : 'Failed to create data producer' 
          });
        }
      });

      // データコンシューマー作成（ゲームデータ受信用）
      socket.on('createDataConsumer', async (data: {
        dataProducerId: string;
        sctpCapabilities: any;
      }) => {
        try {
          debugLog(`Creating data consumer for ${socket.id}`);
          const result = await mediasoupService.createDataConsumer(
            socket.id,
            data.dataProducerId,
            data.sctpCapabilities
          );
          if (result) {
            socket.emit('dataConsumerCreated', result);
          } else {
            socket.emit('error', { message: 'Cannot create data consumer' });
          }
        } catch (error) {
          errorLog(`Failed to create data consumer for ${socket.id}: ${error}`);
          socket.emit('error', { message: 'Failed to create data consumer' });
        }
      });

      // クライアントからのpingに応答
      socket.on('ping', () => {
        debugLog(`Ping received from ${socket.id}`);
        socket.emit('pong');
      });

      // 接続エラーをログ
      socket.on('error', (error) => {
        errorLog(`Socket error for ${socket.id}: ${error}`);
      });

      // 接続の確認
      socket.on('client-ready', (data) => {
        debugLog(`Client ${socket.id} is ready for WebRTC`);
        socket.emit('server-ready', { 
          serverId: socket.id,
          requiresWebRTC: true,
          routerRtpCapabilities: mediasoupService.getRouterCapabilities()
        });
      });

      // 部屋への参加
      socket.on('join-room', async (data: { roomNumber: string; playerInfo: any }) => {
        try {
          const { roomNumber, playerInfo } = data;
          debugLog(`Player ${socket.id} attempting to join room ${roomNumber}`);

          // JWTトークンから実際のユーザー情報を取得
          let realPlayerInfo = playerInfo;
          
          // Socket.IOのハンドシェイクからJWTトークンを取得
          const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
          if (token) {
            const username = extractUsernameFromToken(token);
            if (username) {
              debugLog(`Fetching real profile for user: ${username}`);
              realPlayerInfo = await fetchUserProfile(username);
              debugLog(`Real player info for ${username}: ${realPlayerInfo.name}`);
            }
          }

          // 既に同じ部屋にいるかチェック
          const existingRooms = Array.from(socket.rooms);
          if (existingRooms.includes(roomNumber)) {
            debugLog(`Player ${socket.id} already in room ${roomNumber}`);
            const room = roomManager.getRoom(roomNumber);
            if (room) {
              socket.emit('room-joined', {
                playerId: socket.id,
                playerNumber: room.getPlayerNumber(socket.id),
                players: room.getPlayers(),
                isGameReady: room.getPlayerCount() === 2
              });
            }
            return;
          }

          // 部屋に参加
          const { room, role } = roomManager.joinRoom(roomNumber, socket.id, realPlayerInfo);
          socket.join(roomNumber);

          debugLog(`Player ${socket.id} (${realPlayerInfo.name}) successfully joined room ${roomNumber} as ${role === 'spectator' ? 'spectator' : `player ${role}`}`);

          // 参加者情報を送信
          const roomData = room.getAllParticipants();
          socket.emit('room-joined', {
            playerId: socket.id,
            playerNumber: role,
            players: roomData.players,
            spectators: roomData.spectators,
            isGameReady: room.getPlayerCount() === 2,
            isSpectator: role === 'spectator'
          });

          // 他の参加者に新しい参加者を通知
          socket.to(roomNumber).emit('participant-joined', {
            playerId: socket.id,
            playerInfo: realPlayerInfo,
            role: role,
            players: roomData.players,
            spectators: roomData.spectators,
            isGameReady: room.getPlayerCount() === 2
          });

          // 2人揃ったらゲーム開始準備（実際のプレイヤー情報と共に）
          if (room.getPlayerCount() === 2) {
            io.to(roomNumber).emit('game-ready', {
              players: roomData.players,
              spectators: roomData.spectators
            });
          }

        } catch (error) {
          errorLog(`Error joining room: ${error}`);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // ゲーム状態の同期
      socket.on('game-state', (data: { roomNumber: string; gameState: GameState }) => {
        const { roomNumber, gameState } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          // 他のプレイヤーと観戦者にゲーム状態を送信（送信者以外）
          socket.to(roomNumber).emit('game-state-update', {
            playerId: socket.id,
            gameState
          });
        }
      });

      // 完全なゲーム状態の同期（ボール、パドル、スコア含む）
      socket.on('full-game-state', (data: { roomNumber: string; gameState: GameState }) => {
        const { roomNumber, gameState } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          debugLog(`Full game state update from player ${socket.id} in room ${roomNumber}`);
          // 他のプレイヤーと観戦者に完全なゲーム状態を送信（送信者以外）
          socket.to(roomNumber).emit('full-game-state-update', {
            playerId: socket.id,
            gameState
          });
        }
      });

      // プレイヤーの入力状態
      socket.on('player-input', (data: { roomNumber: string; input: any }) => {
        const { roomNumber, input } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          // 他のプレイヤーと観戦者に入力状態を送信
          socket.to(roomNumber).emit('player-input-update', {
            playerId: socket.id,
            playerNumber: room.getPlayerNumber(socket.id),
            input
          });
        }
      });

      // スコア更新
      socket.on('score-update', (data: { roomNumber: string; scorer: 'player1' | 'player2' }) => {
        const { roomNumber, scorer } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          debugLog(`Score update from player ${socket.id}: ${scorer} scored in room ${roomNumber}`);
          
          // サーバー側でスコアを管理
          const gameEnded = room.updateScore(scorer);
          const gameState = room.getGameState();
          
          // 全プレイヤーにスコア更新を送信
          io.to(roomNumber).emit('score-updated', {
            scorer,
            playerId: socket.id,
            scores: gameState.scores,
            gameOver: gameState.gameOver,
            winner: gameState.winner
          });
          
          // ゲーム終了の場合
          if (gameEnded) {
            debugLog(`Game ended in room ${roomNumber}, winner: player ${gameState.winner}`);
            io.to(roomNumber).emit('game-ended', {
              winner: gameState.winner,
              playerId: socket.id,
              finalScores: gameState.scores
            });
          }
        }
      });

      // ゲーム開始要求（ドアクリック）
      socket.on('start-game', (data: { roomNumber: string }) => {
        const { roomNumber } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          debugLog(`Player ${socket.id} requested to start game in room ${roomNumber}`);

          // 部屋に2人いる場合のみゲーム開始
          if (room.getPlayerCount() === 2) {
            debugLog(`Starting game in room ${roomNumber}`);
            
            // サーバー側でゲーム開始
            room.startGame();
            
            // 全プレイヤーにゲーム開始を送信
            io.to(roomNumber).emit('game-started', {
              roomNumber,
              players: room.getPlayers(),
              initiator: socket.id,
              gameState: room.getGameState()
            });
          } else {
            // プレイヤーが不足している場合
            socket.emit('game-start-failed', {
              reason: 'Need 2 players to start the game',
              currentPlayers: room.getPlayerCount()
            });
          }
        }
      });

      // ゲーム終了
      socket.on('game-end', (data: { roomNumber: string; winner: number }) => {
        const { roomNumber, winner } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          debugLog(`Game ended in room ${roomNumber}, winner: ${winner}`);
          
          // 全プレイヤーにゲーム終了を送信
          io.to(roomNumber).emit('game-ended', {
            winner,
            playerId: socket.id
          });
          
          // ゲーム終了後、部屋をリセット状態にする
          setTimeout(() => {
            if (room) {
              room.resetGame();
              debugLog(`Room ${roomNumber} reset after game end`);
            }
          }, 2000);
        }
      });

      // 切断処理
      socket.on('disconnect', (reason) => {
        debugLog(`Client disconnected: ${socket.id}, Reason: ${reason}`);
        debugLog(`Total connected clients: ${io.sockets.sockets.size}`);

        // プレイヤーを全ての部屋から削除
        const roomNumber = roomManager.removePlayer(socket.id);
        if (roomNumber) {
          debugLog(`Player ${socket.id} left room ${roomNumber}`);
          socket.to(roomNumber).emit('player-left', {
            playerId: socket.id
          });
        }
      });

      // 部屋から退出
      socket.on('leave-room', (data: { roomNumber: string }) => {
        const { roomNumber } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          room.removePlayer(socket.id);
          socket.leave(roomNumber);

          socket.to(roomNumber).emit('player-left', {
            playerId: socket.id
          });

          // 部屋が空になったら削除
          if (room.getPlayerCount() === 0) {
            roomManager.removeRoom(roomNumber);
          }
        }
      });

      // ======== トーナメント関連のイベントハンドラー ========

      // トーナメント作成
      socket.on('create-tournament', async (data: { maxPlayers: number; playerInfo: any }) => {
        try {
          const { maxPlayers, playerInfo } = data;
          
          // JWTトークンから実際のユーザー情報を取得
          let realPlayerInfo = playerInfo;
          
          // Socket.IOのハンドシェイクからJWTトークンを取得
          const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
          if (token) {
            const username = extractUsernameFromToken(token);
            if (username) {
              debugLog(`Fetching real profile for tournament creator: ${username}`);
              realPlayerInfo = await fetchUserProfile(username);
              debugLog(`Real tournament creator info for ${username}: ${realPlayerInfo.name}`);
            }
          }
          
          const tournamentId = Math.floor(100000 + Math.random() * 900000).toString();
          
          const tournament = tournamentManager.createTournament(tournamentId, maxPlayers);
          const role = tournamentManager.addPlayer(tournamentId, socket.id, realPlayerInfo);
          
          socket.join(`tournament-${tournamentId}`);
          
          const participants = tournamentManager.getAllParticipants(tournamentId);
          
          socket.emit('tournament-created', {
            tournamentId,
            tournament,
            playerId: socket.id,
            role,
            participants
          });

          debugLog(`Tournament ${tournamentId} created with max ${maxPlayers} players by ${realPlayerInfo.name} (${realPlayerInfo.id})`);
        } catch (error) {
          errorLog(`Error creating tournament: ${error}`);
          socket.emit('error', { message: 'Failed to create tournament' });
        }
      });

      // トーナメント参加
      socket.on('join-tournament', async (data: { tournamentId: string; playerInfo: any }) => {
        try {
          const { tournamentId, playerInfo } = data;
          
          // JWTトークンから実際のユーザー情報を取得
          let realPlayerInfo = playerInfo;
          
          // Socket.IOのハンドシェイクからJWTトークンを取得
          const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
          if (token) {
            const username = extractUsernameFromToken(token);
            if (username) {
              debugLog(`Fetching real profile for tournament player: ${username}`);
              realPlayerInfo = await fetchUserProfile(username);
              debugLog(`Real tournament player info for ${username}: ${realPlayerInfo.name}`);
            }
          }
          
          const role = tournamentManager.addPlayer(tournamentId, socket.id, realPlayerInfo);
          const tournament = tournamentManager.getTournament(tournamentId);
          
          if (!tournament) {
            socket.emit('error', { message: 'Tournament not found' });
            return;
          }

          socket.join(`tournament-${tournamentId}`);
          
          const participants = tournamentManager.getAllParticipants(tournamentId);
          
          socket.emit('tournament-joined', {
            tournamentId,
            tournament,
            playerId: socket.id,
            role,
            participants
          });

          // 他の参加者に新しい参加者を通知
          socket.to(`tournament-${tournamentId}`).emit('tournament-participant-joined', {
            playerId: socket.id,
            playerInfo: realPlayerInfo,
            role,
            participants
          });

          debugLog(`Player ${socket.id} (${realPlayerInfo.name}) joined tournament ${tournamentId} as ${role}`);
        } catch (error) {
          errorLog(`Error joining tournament: ${error}`);
          socket.emit('error', { message: 'Failed to join tournament' });
        }
      });

      // トーナメント開始
      socket.on('start-tournament', async (data: { tournamentId: string }) => {
        try {
          const { tournamentId } = data;
          
          const success = tournamentManager.startTournament(tournamentId);
          if (!success) {
            socket.emit('tournament-start-failed', { 
              reason: 'Tournament cannot be started' 
            });
            return;
          }

          const tournament = tournamentManager.getTournament(tournamentId);
          const nextMatches = tournamentManager.getNextMatches(tournamentId);

          // 全参加者にトーナメント開始を通知
          io.to(`tournament-${tournamentId}`).emit('tournament-started', {
            tournamentId,
            tournament,
            nextMatches
          });

          debugLog(`Tournament ${tournamentId} started with ${tournament?.players.length} players`);
        } catch (error) {
          errorLog(`Error starting tournament: ${error}`);
          socket.emit('error', { message: 'Failed to start tournament' });
        }
      });

      // 試合結果報告
      socket.on('tournament-match-result', async (data: { 
        tournamentId: string; 
        matchId: string; 
        winnerId: string;
      }) => {
        try {
          const { tournamentId, matchId, winnerId } = data;
          
          const success = tournamentManager.recordMatchResult(tournamentId, matchId, winnerId);
          if (!success) {
            socket.emit('error', { message: 'Failed to record match result' });
            return;
          }

          const tournament = tournamentManager.getTournament(tournamentId);
          const match = tournamentManager.getMatch(tournamentId, matchId);
          
          if (!tournament || !match) {
            socket.emit('error', { message: 'Tournament or match not found' });
            return;
          }

          // 該当する試合のプレイヤーのみに試合結果を通知
          const matchPlayers = tournamentManager.getMatchPlayers(tournamentId, matchId);
          
          // 勝者と敗者を特定
          const winnerId_actual = match.winner?.playerId;
          const loserId = matchPlayers.find(id => id !== winnerId_actual);
          
          console.log(`Match ${matchId} completed. Winner: ${winnerId_actual}, Loser: ${loserId}`);

          // 各プレイヤーに個別の情報を送信
          for (const playerId of matchPlayers) {
            const playerSocket = io.sockets.sockets.get(playerId);
            if (playerSocket) {
              const isWinner = playerId === winnerId_actual;
              
              playerSocket.emit('tournament-match-completed', {
                tournamentId,
                match,
                tournament,
                isWinner,
                isEliminated: !isWinner
              });

              console.log(`Sent match result to ${playerId}: ${isWinner ? 'WINNER' : 'ELIMINATED'}`);
            }
          }

          // ラウンド進行チェック
          const roundAdvanced = tournamentManager.advanceRound(tournamentId);
          if (roundAdvanced) {
            const nextMatches = tournamentManager.getNextMatches(tournamentId);
            
            // 次のラウンドに進む勝者のみに通知
            for (const nextMatch of nextMatches) {
              const advancingPlayers = tournamentManager.getMatchPlayers(tournamentId, nextMatch.id);
              
              for (const playerId of advancingPlayers) {
                const playerSocket = io.sockets.sockets.get(playerId);
                if (playerSocket) {
                  playerSocket.emit('tournament-round-advanced', {
                    tournamentId,
                    tournament,
                    nextMatches: [nextMatch], // そのプレイヤーの試合のみ
                    currentMatch: nextMatch
                  });
                  
                  console.log(`Sent round advancement to ${playerId} for match ${nextMatch.id}`);
                }
              }
            }
          }

          // トーナメント完了チェック
          if (tournament?.status === 'COMPLETED') {
            // 全参加者にトーナメント完了を通知（これは全員が知るべき情報）
            io.to(`tournament-${tournamentId}`).emit('tournament-completed', {
              tournamentId,
              tournament,
              winner: tournament.winner
            });
            debugLog(`Tournament ${tournamentId} completed, winner: ${tournament.winner?.playerInfo.name}`);
          }

        } catch (error) {
          errorLog(`Error recording tournament match result: ${error}`);
          socket.emit('error', { message: 'Failed to record match result' });
        }
      });

      // トーナメント情報取得
      socket.on('get-tournament', async (data: { tournamentId: string }) => {
        try {
          const { tournamentId } = data;
          const tournament = tournamentManager.getTournament(tournamentId);
          const participants = tournamentManager.getAllParticipants(tournamentId);
          const progress = tournamentManager.getTournamentProgress(tournamentId);
          
          socket.emit('tournament-info', {
            tournament,
            participants,
            progress
          });
        } catch (error) {
          errorLog(`Error getting tournament info: ${error}`);
          socket.emit('error', { message: 'Failed to get tournament info' });
        }
      });

      // プレイヤーの現在の試合取得
      socket.on('get-current-match', async (data: { tournamentId: string }) => {
        try {
          const { tournamentId } = data;
          const match = tournamentManager.getPlayerCurrentMatch(tournamentId, socket.id);
          
          socket.emit('current-match', {
            tournamentId,
            match
          });
        } catch (error) {
          console.error('Error getting current match:', error);
          socket.emit('error', { message: 'Failed to get current match' });
        }
      });

      // トーナメントから退出
      socket.on('leave-tournament', async (data: { tournamentId: string }) => {
        try {
          const { tournamentId } = data;
          
          const success = tournamentManager.removeParticipant(tournamentId, socket.id);
          if (success) {
            socket.leave(`tournament-${tournamentId}`);
            
            const participants = tournamentManager.getAllParticipants(tournamentId);
            
            // 他の参加者に退出を通知
            socket.to(`tournament-${tournamentId}`).emit('tournament-participant-left', {
              playerId: socket.id,
              participants
            });

            console.log(`Player ${socket.id} left tournament ${tournamentId}`);
          }
        } catch (error) {
          errorLog(`Error leaving tournament: ${error}`);
        }
      });

      // ルーターRTPCapabilities要求への応答
      socket.on('get-router-capabilities', () => {
        debugLog(`[${socket.id}] Router capabilities requested`);
        try {
          const capabilities = mediasoupService.getRouterCapabilities();
          socket.emit('router-capabilities', capabilities);
          debugLog(`[${socket.id}] Router capabilities sent`);
        } catch (error) {
          errorLog(`[${socket.id}] Failed to get router capabilities: ${error}`);
          socket.emit('error', { message: 'Failed to get router capabilities' });
        }
      });
    });

    // ヘルスチェックエンドポイント
    app.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Mediasoup Router RTP capabilities エンドポイント
    app.get('/api/router-rtp-capabilities', async (request: any, reply: any) => {
      try {
        const rtpCapabilities = mediasoupService.getRouterCapabilities();
        return { rtpCapabilities };
      } catch (error) {
        errorLog(`Failed to get router RTP capabilities: ${error}`);
        return reply.status(500).send({
          error: 'Failed to get router RTP capabilities',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // WebRTC Transport作成エンドポイント
    app.post('/api/create-transport', async (request: any, reply: any) => {
      try {
        const { socketId } = request.body;
        if (!socketId) {
          return reply.status(400).send({ error: 'socketId is required' });
        }
        
        const transport = await mediasoupService.createWebRtcTransport(socketId);
        return transport;
      } catch (error) {
        errorLog(`Failed to create transport: ${error}`);
        return reply.status(500).send({
          error: 'Failed to create transport',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Transport接続エンドポイント
    app.post('/api/connect-transport', async (request: any, reply: any) => {
      try {
        const { socketId, dtlsParameters } = request.body;
        if (!socketId || !dtlsParameters) {
          return reply.status(400).send({ 
            error: 'socketId and dtlsParameters are required' 
          });
        }
        
        await mediasoupService.connectTransport(socketId, dtlsParameters);
        return { success: true };
      } catch (error) {
        errorLog(`Failed to connect transport: ${error}`);
        return reply.status(500).send({
          error: 'Failed to connect transport',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Data Producer作成エンドポイント
    app.post('/api/create-data-producer', async (request: any, reply: any) => {
      try {
        const { socketId, sctpStreamParameters, label, protocol, appData } = request.body;
        if (!socketId || !sctpStreamParameters) {
          return reply.status(400).send({ 
            error: 'socketId and sctpStreamParameters are required' 
          });
        }
        
        const dataProducer = await mediasoupService.createDataProducer(
          socketId, 
          sctpStreamParameters, 
          label || 'gameData',
          protocol || 'gameProtocol',
          appData || {}
        );
        return { id: dataProducer.id };
      } catch (error) {
        errorLog(`Failed to create data producer: ${error}`);
        return reply.status(500).send({
          error: 'Failed to create data producer',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // サーバー情報エンドポイント
    app.get('/info', async (request, reply) => {
      return {
        service: 'pong-sfu-server',
        version: '1.0.0',
        rooms: roomManager.getRoomCount(),
        activePlayers: roomManager.getTotalPlayers(),
        tournaments: tournamentManager.getAllTournaments().length
      };
    });

    // トーナメント一覧取得エンドポイント
    app.get('/tournaments', async (request, reply) => {
      return {
        tournaments: tournamentManager.getAllTournaments().map(t => ({
          id: t.id,
          maxPlayers: t.maxPlayers,
          playerCount: t.players.length,
          spectatorCount: t.spectators.size,
          status: t.status,
          createdAt: t.createdAt,
          currentRound: t.currentRound
        }))
      };
    });

    // DTLS接続統計エンドポイント
    app.get('/dtls-stats', async (request, reply) => {
      const stats = {
        totalTransports: 0,
        activeTransports: 0,
        connectedTransports: 0,
        dtlsStates: {} as Record<string, number>,
        iceStates: {} as Record<string, number>,
        dataProducers: 0,
        dataConsumers: 0,
        transports: [] as any[]
      };

      // トランスポート統計を収集
      try {
        // MediasoupServiceから統計を取得（メソッドを追加する必要がある）
        const transportStats = await mediasoupService.getTransportStats();
        
        stats.totalTransports = transportStats.total;
        stats.activeTransports = transportStats.active;
        stats.connectedTransports = transportStats.connected;
        stats.dtlsStates = transportStats.dtlsStates;
        stats.iceStates = transportStats.iceStates;
        stats.dataProducers = transportStats.dataProducers;
        stats.dataConsumers = transportStats.dataConsumers;
        stats.transports = transportStats.details;

      } catch (error) {
        errorLog(`Failed to get transport stats: ${error}`);
      }

      return {
        timestamp: new Date().toISOString(),
        stats,
        message: 'DTLS/WebRTC transport statistics'
      };
    });

    // 特定のクライアントのDTLS状態を取得
    app.get('/dtls-stats/:socketId', async (request, reply) => {
      const { socketId } = request.params as { socketId: string };
      
      try {
        const clientStats = await mediasoupService.getClientTransportStats(socketId);
        
        if (!clientStats) {
          return reply.status(404).send({ 
            error: 'Client not found',
            socketId 
          });
        }

        return {
          socketId,
          timestamp: new Date().toISOString(),
          stats: clientStats,
          message: `DTLS stats for client ${socketId}`
        };
      } catch (error) {
        errorLog(`Failed to get stats for client ${socketId}: ${error}`);
        return reply.status(500).send({ 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    const PORT = process.env.PORT || 3001;
    const protocol = sslOptions ? 'HTTPS' : 'HTTP';

    // Socket.IOをFastifyサーバーに接続（サーバー起動前）
    io.attach(app.server);

    // Fastifyサーバーを起動
    await app.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`${protocol} SFU Server running on port ${PORT}`);
    
    if (sslOptions) {
      console.log('WSS (WebSocket Secure) connections enabled');
    } else {
      console.log('WS (WebSocket) connections enabled');
    }

  } catch (error) {
    errorLog(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

// サーバーを開始
startServer().catch((error) => errorLog(`Server startup failed: ${error}`));

// グレースフルシャットダウン
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mediasoupService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await mediasoupService.close();
  process.exit(0);
});
