import fastify from 'fastify';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MediasoupService } from './mediasoup-service';
import { RoomManager } from './room-manager';
import { TournamentManager } from './tournament-manager';
import { GameState } from './types';
import * as fs from 'fs';
import * as path from 'path';

// SSL証明書の設定
const getSSLOptions = () => {
  const certDir = '/app/certs';
  const keyPath = path.join(certDir, 'server-san.key');
  const certPath = path.join(certDir, 'server-san.crt');
  
  try {
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
    }
  } catch (error: any) {
    console.warn('SSL certificates not found, falling back to HTTP:', error?.message || error);
  }
  return null;
};

const sslOptions = getSSLOptions();
const app = fastify({ 
  logger: true,
  ...(sslOptions && { https: sslOptions })
});

// CORSの設定 - 全世界からのアクセスを許可
// Fastify CORS設定
app.register(require('@fastify/cors'), {
  origin: true, // 全てのオリジンを許可
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Socket.IOサーバーの設定
const io = new SocketIOServer({
  cors: {
    origin: true, // 全てのオリジンを許可
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// MediasoupとRoomManagerとTournamentManagerのインスタンス
const mediasoupService = new MediasoupService();
const roomManager = new RoomManager();
const tournamentManager = new TournamentManager();

async function startServer() {
  try {
    // Mediasoupワーカーを初期化
    await mediasoupService.initialize();
    console.log('Mediasoup service initialized');
    console.log('Starting Socket.IO event handlers...');

    // Socket.IOイベントハンドラー
    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      console.log(`Total connected clients: ${io.sockets.sockets.size}`);

      // 接続時にクライアントに確認メッセージを送信
      socket.emit('connection-confirmed', {
        message: 'Successfully connected to SFU server',
        serverId: socket.id
      });

      // クライアントからのpingに応答
      socket.on('ping', () => {
        console.log(`Ping received from ${socket.id}`);
        socket.emit('pong');
      });

      // 接続エラーをログ
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });

      // 接続の確認
      socket.on('client-ready', (data) => {
        console.log(`Client ${socket.id} is ready:`, data);
        socket.emit('server-ready', { serverId: socket.id });
      });

      // 部屋への参加
      socket.on('join-room', async (data: { roomNumber: string; playerInfo: any }) => {
        try {
          const { roomNumber, playerInfo } = data;
          console.log(`Player ${socket.id} attempting to join room ${roomNumber}`);

          // 既に同じ部屋にいるかチェック
          const existingRooms = Array.from(socket.rooms);
          if (existingRooms.includes(roomNumber)) {
            console.log(`Player ${socket.id} already in room ${roomNumber}`);
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
          const { room, role } = roomManager.joinRoom(roomNumber, socket.id, playerInfo);
          socket.join(roomNumber);

          console.log(`Player ${socket.id} successfully joined room ${roomNumber} as ${role === 'spectator' ? 'spectator' : `player ${role}`}`);

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
            playerInfo,
            role: role,
            players: roomData.players,
            spectators: roomData.spectators,
            isGameReady: room.getPlayerCount() === 2
          });

          // 2人揃ったらゲーム開始準備
          if (room.getPlayerCount() === 2) {
            io.to(roomNumber).emit('game-ready', {
              players: roomData.players,
              spectators: roomData.spectators
            });
          }

        } catch (error) {
          console.error('Error joining room:', error);
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
          console.log(`Full game state update from player ${socket.id} in room ${roomNumber}`);
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
          console.log(`Score update from player ${socket.id}: ${scorer} scored in room ${roomNumber}`);
          
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
            console.log(`Game ended in room ${roomNumber}, winner: player ${gameState.winner}`);
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
          console.log(`Player ${socket.id} requested to start game in room ${roomNumber}`);

          // 部屋に2人いる場合のみゲーム開始
          if (room.getPlayerCount() === 2) {
            console.log(`Starting game in room ${roomNumber}`);
            
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
          // 全プレイヤーにゲーム終了を送信
          io.to(roomNumber).emit('game-ended', {
            winner,
            playerId: socket.id
          });
        }
      });

      // 切断処理
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
        console.log(`Total connected clients: ${io.sockets.sockets.size}`);

        // プレイヤーを全ての部屋から削除
        const roomNumber = roomManager.removePlayer(socket.id);
        if (roomNumber) {
          console.log(`Player ${socket.id} left room ${roomNumber}`);
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
          const tournamentId = Math.floor(100000 + Math.random() * 900000).toString();
          
          const tournament = tournamentManager.createTournament(tournamentId, maxPlayers);
          const role = tournamentManager.addPlayer(tournamentId, socket.id, playerInfo);
          
          socket.join(`tournament-${tournamentId}`);
          
          socket.emit('tournament-created', {
            tournamentId,
            tournament,
            playerId: socket.id,
            role
          });

          console.log(`Tournament ${tournamentId} created with max ${maxPlayers} players`);
        } catch (error) {
          console.error('Error creating tournament:', error);
          socket.emit('error', { message: 'Failed to create tournament' });
        }
      });

      // トーナメント参加
      socket.on('join-tournament', async (data: { tournamentId: string; playerInfo: any }) => {
        try {
          const { tournamentId, playerInfo } = data;
          
          const role = tournamentManager.addPlayer(tournamentId, socket.id, playerInfo);
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
            playerInfo,
            role,
            participants
          });

          console.log(`Player ${socket.id} joined tournament ${tournamentId} as ${role}`);
        } catch (error) {
          console.error('Error joining tournament:', error);
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

          console.log(`Tournament ${tournamentId} started with ${tournament?.players.length} players`);
        } catch (error) {
          console.error('Error starting tournament:', error);
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
            console.log(`Tournament ${tournamentId} completed, winner: ${tournament.winner?.playerInfo.name}`);
          }

        } catch (error) {
          console.error('Error recording tournament match result:', error);
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
          console.error('Error getting tournament info:', error);
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
          console.error('Error leaving tournament:', error);
        }
      });
    });

    // ヘルスチェックエンドポイント
    app.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
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

    const PORT = process.env.PORT || 3001;
    const protocol = sslOptions ? 'HTTPS' : 'HTTP';

    // Fastifyサーバーを起動
    await app.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`${protocol} SFU Server running on port ${PORT}`);
    
    if (sslOptions) {
      console.log('WSS (WebSocket Secure) connections enabled');
    } else {
      console.log('WS (WebSocket) connections enabled');
    }

    // Socket.IOをFastifyサーバーに接続
    io.attach(app.server);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// サーバーを開始
startServer().catch(console.error);

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
