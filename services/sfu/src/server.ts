import fastify from 'fastify';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MediasoupService } from './mediasoup-service';
import { RoomManager } from './room-manager';
import { TournamentManager } from './tournament-manager';
import { GamePong42Manager } from './game-pong42-manager';
import { GameState, NPCRequest } from './types';
import * as fs from 'fs';
import * as path from 'path';

// SSL証明書の設定
const getSSLOptions = () => {
  const certDirs = ['/app/internal-certs', '/app/certs', '/certs', './certs'];

  console.log('=== SSL Certificate Debug ===');

  for (const certDir of certDirs) {
    console.log(`Checking certificate directory: ${certDir}`);

    // 証明書ディレクトリの存在確認
    if (!fs.existsSync(certDir)) {
      console.log(`Certificate directory does not exist: ${certDir}`);
      continue;
    }

    // ディレクトリの内容を表示
    try {
      const files = fs.readdirSync(certDir);
      console.log('Files in certificate directory:', files);

      // 共通証明書のパス
      const keyPath = path.join(certDir, 'server.key');
      const certPath = path.join(certDir, 'server.crt');

      console.log('Checking certificate paths:');
      console.log('- Common key:', keyPath, 'exists:', fs.existsSync(keyPath));
      console.log('- Common cert:', certPath, 'exists:', fs.existsSync(certPath));

      // まず共通証明書を試す
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        console.log('Using common SSL certificates from:', certDir);
        const keyContent = fs.readFileSync(keyPath);
        const certContent = fs.readFileSync(certPath);
        console.log('Successfully read common SSL certificates');
        console.log('Key size:', keyContent.length, 'bytes');
        console.log('Cert size:', certContent.length, 'bytes');
        console.log('=== End SSL Certificate Debug ===');
        return {
          key: keyContent,
          cert: certContent
        };
      }

    } catch (error) {
      console.log(`Error accessing certificate directory ${certDir}:`, error);
      continue;
    }
  }

  console.error('No valid SSL certificate files found in any directory');

  // 自己署名証明書を生成
  console.log('Generating self-signed certificate...');
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

    console.log('Generated self-signed certificate');
    console.log('Key size:', keyContent.length, 'bytes');
    console.log('Cert size:', certContent.length, 'bytes');
    console.log('=== End SSL Certificate Debug ===');

    return {
      key: keyContent,
      cert: certContent
    };
  } catch (error: any) {
    console.error('Error generating self-signed certificate:', error?.message || error);
  }

  console.log('=== End SSL Certificate Debug ===');
  return null;
};

const sslOptions = getSSLOptions();
const app = fastify({
  logger: true,
});

// CORSの設定 - 全世界からのアクセスを許可
app.register(require('@fastify/cors'), {
  origin: true, // 全てのオリジンを許可
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Socket.IOサーバーの設定（Fastifyサーバーと統合）
let io: SocketIOServer;

// MediasoupとRoomManagerとTournamentManagerとGamePong42Managerのインスタンス
const mediasoupService = new MediasoupService();
const roomManager = new RoomManager();
const tournamentManager = new TournamentManager();
const gamePong42Manager = new GamePong42Manager();

// npc_managerへの接続
async function requestNPCsFromManager(npcCount: number, roomId: string) {
  if (npcCount <= 0) {
    console.log('🤖 No NPCs needed (npcCount <= 0)');
    return [];
  }

  const npcManagerUrl = process.env.NPC_MANAGER_URL || 'http://npc_manager:3003';
  console.log(`🤖 Requesting ${npcCount} NPCs from NPC Manager at ${npcManagerUrl}...`);

  try {
    const response = await fetch(`${npcManagerUrl}/gamepong42/request-npcs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomNumber: roomId,  // roomIdからroomNumberに変更
        npcCount: npcCount,
        gameType: 'gamepong42'
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`🤖 Successfully requested NPCs from manager:`, result);
    return result.npcs || [];
  } catch (error) {
    console.error('❌ Error requesting NPCs from manager:', error);
    return [];
  }
}

async function startServer() {
  try {
    // Mediasoupワーカーを初期化
    await mediasoupService.initialize();
    console.log('Mediasoup service initialized');

    // npc_managerとの通信準備
    console.log('NPC Manager connection prepared');

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

    // Socket.IOサーバーを初期化（Fastifyサーバー起動後）
    // FastifyのHTTPサーバーインスタンスを取得
    const httpServer = app.server;

    io = new SocketIOServer(httpServer, {
      cors: {
        origin: true, // 全てのオリジンを許可
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io/',
      serveClient: false
    });

    console.log('✅ Socket.IO server initialized successfully');

    // Socket.IOイベントハンドラーを設定
    io.on('connection', (socket: Socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      console.log(`🔌 Total connected clients: ${io.sockets.sockets.size}`);
      console.log(`🔌 Socket transport: ${socket.conn.transport.name}`);

      // 接続時にクライアントに確認メッセージを送信
      socket.emit('connection-confirmed', {
        message: 'Successfully connected to SFU server',
        serverId: socket.id
      });

      // すべてのイベントをログ出力（デバッグ用）
      socket.onAny((eventName, ...args) => {
        console.log(`📨 Event received from ${socket.id}: ${eventName}`, args);
      });

      // 切断時の詳細ログ
      socket.on('disconnect', (reason, details) => {
        console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
        if (details) {
          console.log('Disconnect details:', details);
        }
        console.log(`Total connected clients: ${io.sockets.sockets.size}`);

        // プレイヤーを全ての部屋から削除
        const roomNumber = roomManager.removePlayer(socket.id);
        if (roomNumber) {
          console.log(`Player ${socket.id} left room ${roomNumber}`);
          socket.to(roomNumber).emit('player-left', {
            playerId: socket.id
          });
        }

        // GamePong42の部屋からも削除
        const gamePong42Rooms = gamePong42Manager.getAllRooms();
        for (const room of gamePong42Rooms) {
          if (room.hasParticipant(socket.id)) {
            gamePong42Manager.removeParticipant(room.id, socket.id);
            socket.to(`gamepong42-${room.id}`).emit('gamepong42-participant-left', {
              playerId: socket.id
            });
            console.log(`Player ${socket.id} left GamePong42 room ${room.id}`);
          }
        }
      });      // GamePong42への参加
      socket.on('join-gamepong42', async (data: { roomNumber?: string; playerInfo: any }) => {
        try {
          console.log(`Player ${socket.id} joining GamePong42:`, data);

          const { roomNumber, playerInfo } = data;

          // ルームIDを決定（指定されていればそれを使用、なければデフォルト）
          const roomId = roomNumber || 'default';
          const room = gamePong42Manager.addParticipant(roomId, socket.id, playerInfo);

          console.log(`Player ${socket.id} joined GamePong42 room ${roomId}`);
          console.log(`Room ${roomId} now has ${room.getParticipantCount()} participants`);

          // Socket.IOルームに参加
          await socket.join(`gamepong42-${roomId}`);

          // カウントダウン時間を計算
          const timeUntilStart = Math.max(0, room.countdown);

          // クライアントに参加確認を送信
          socket.emit('gamepong42-joined', {
            roomNumber: roomId, // roomNumberとして返す
            participantCount: room.getParticipantCount(),
            timeUntilStart: timeUntilStart,
            isStarted: room.gameStarted
          });

          // 他の参加者に新しい参加者を通知
          socket.to(`gamepong42-${roomId}`).emit('gamepong42-participant-joined', {
            playerId: socket.id,
            playerInfo,
            participantCount: room.getParticipantCount(),
            timeUntilStart: timeUntilStart
          });

          // ゲーム開始チェック
          if (room.shouldStartGame()) {
            console.log(`🎮 GamePong42 room ${roomId} is ready to start!`);

            // NPCリクエスト
            const npcCount = Math.max(0, 42 - room.getParticipantCount());
            console.log(`📊 Current participants: ${room.getParticipantCount()}, NPCs needed: ${npcCount}`);

            if (npcCount > 0) {
              // NPCをリクエスト
              try {
                const npcManagerUrl = process.env.NPC_MANAGER_URL || 'http://npc_manager:3003';
                console.log(`🤖 Requesting ${npcCount} NPCs from ${npcManagerUrl}`);

                const response = await fetch(`${npcManagerUrl}/gamepong42/request-npcs`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    roomNumber: roomId,  // roomIdからroomNumberに変更
                    npcCount: npcCount,
                    sfuUrl: process.env.SFU_URL || 'http://sfu:3001'
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  console.log(`✅ NPC request successful:`, result);
                } else {
                  console.error(`❌ NPC request failed: ${response.status} ${response.statusText}`);
                  const errorText = await response.text();
                  console.error('NPC request error details:', errorText);
                }
              } catch (error: any) {
                console.error('❌ Error requesting NPCs:', error?.message || error);
              }
            } else {
              console.log(`⚡ 42 participants reached - no NPCs needed`);
            }

            // ゲーム開始
            room.startGame();

            // ゲーム状態配信の設定
            setupGameStateDistribution(roomId);

            io.to(`gamepong42-${roomId}`).emit('gamepong42-game-started', {
              roomNumber: roomId, // roomNumberとして送信
              participantCount: room.getParticipantCount(),
              npcCount: npcCount
            });
          }

        } catch (error) {
          console.error(`Error joining GamePong42:`, error);
          socket.emit('error', { message: 'Failed to join GamePong42' });
        }
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

      // === WebRTC/Mediasoup Event Handlers ===

      // Router RTP capabilities要求
      socket.on('get-router-rtp-capabilities', (callback) => {
        try {
          console.log(`📡 Client ${socket.id} requesting RTP capabilities`);
          const rtpCapabilities = mediasoupService.getRouterCapabilities();
          callback({ rtpCapabilities });
        } catch (error: any) {
          console.error('❌ Error getting RTP capabilities:', error);
          callback({ error: error?.message || 'Failed to get RTP capabilities' });
        }
      });

      // WebRTC Transport作成
      socket.on('create-webrtc-transport', async (data: { direction: 'send' | 'recv' }, callback) => {
        try {
          console.log(`🚗 Client ${socket.id} creating ${data.direction} transport`);
          const transportData = await mediasoupService.createWebRtcTransport(socket.id);
          callback(transportData);
        } catch (error: any) {
          console.error(`❌ Error creating ${data.direction} transport:`, error);
          callback({ error: error?.message || 'Failed to create transport' });
        }
      });

      // Transport接続
      socket.on('connect-transport', async (data: { transportId: string; dtlsParameters: any }, callback) => {
        try {
          console.log(`🔗 Client ${socket.id} connecting transport ${data.transportId}`);
          await mediasoupService.connectTransport(socket.id, data.dtlsParameters);
          callback({ success: true });
        } catch (error: any) {
          console.error('❌ Error connecting transport:', error);
          callback({ error: error?.message || 'Failed to connect transport' });
        }
      });

      // Producer作成
      socket.on('produce', async (data: { transportId: string; kind: string; rtpParameters: any }, callback) => {
        try {
          console.log(`🎬 Client ${socket.id} producing ${data.kind}`);
          const result = await mediasoupService.produce(socket.id, data.kind as 'audio' | 'video', data.rtpParameters);
          callback(result);
        } catch (error: any) {
          console.error('❌ Error producing:', error);
          callback({ error: error?.message || 'Failed to produce' });
        }
      });

      // DataProducer作成
      socket.on('produce-data', async (data: { transportId: string; sctpStreamParameters: any; label: string; protocol: string }, callback) => {
        try {
          console.log(`📊 Client ${socket.id} producing data: ${data.label}`);
          const result = await mediasoupService.produceData(socket.id, data.sctpStreamParameters, data.label, data.protocol);
          callback(result);
        } catch (error: any) {
          console.error('❌ Error producing data:', error);
          callback({ error: error?.message || 'Failed to produce data' });
        }
      });

      // === GamePong42 Data Channel Events ===

      // プレイヤー入力受信（データチャンネル経由）
      socket.on('gamepong42-player-input', (data: { roomId: string; input: any }) => {
        try {
          const { roomId, input } = data;
          const room = gamePong42Manager.getRoom(roomId);

          if (room && room.gameStarted) {
            // プレイヤー入力を処理
            const playerInput = {
              playerId: socket.id,
              input: input,
              timestamp: Date.now()
            };

            room.processPlayerInput(playerInput);
            console.log(`🎮 Processed input for player ${socket.id} in room ${roomId}`);
          }
        } catch (error) {
          console.error('❌ Error processing player input:', error);
        }
      });

      // ゲーム状態リクエスト
      socket.on('gamepong42-get-state', (data: { roomId: string }, callback) => {
        try {
          const { roomId } = data;
          const room = gamePong42Manager.getRoom(roomId);

          if (room) {
            const gameState = room.getGameState();
            callback({ success: true, gameState });
          } else {
            callback({ success: false, error: 'Room not found' });
          }
        } catch (error: any) {
          console.error('❌ Error getting game state:', error);
          callback({ success: false, error: error?.message || 'Failed to get game state' });
        }
      });

      // ゲーム状態配信の設定
      const setupGameStateDistribution = (roomId: string) => {
        const room = gamePong42Manager.getRoom(roomId);
        if (!room) return;

        // ゲーム状態更新コールバックを設定
        room.onGameStateUpdate = (update) => {
          try {
            // 該当ルームの全参加者にSocket.IO経由でゲーム状態を送信
            io.to(`gamepong42-${roomId}`).emit('gamepong42-game-state-update', update);

            // デバッグログ（頻度を制限）
            if (Date.now() % 1000 < 17) { // 約60FPSのうち1秒に1回程度
              console.log(`📊 Game state updated for room ${roomId}, participants: ${room.participants.size}`);
            }
          } catch (error) {
            console.error('❌ Error distributing game state:', error);
          }
        };

        console.log(`✅ Game state distribution setup complete for room ${roomId}`);
      };

      // GamePong42ルーム参加時にゲーム状態配信を設定
      socket.on('gamepong42-setup-data-channel', (data: { roomId: string }) => {
        try {
          const { roomId } = data;
          console.log(`📊 Setting up data channel for room ${roomId}`);
          setupGameStateDistribution(roomId);
        } catch (error) {
          console.error('❌ Error setting up data channel:', error);
        }
      });
    });

    console.log('✅ Socket.IO event handlers set up successfully');

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
