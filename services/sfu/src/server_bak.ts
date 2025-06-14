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

// 開発環境では一時的にHTTPを使用
const sslOptions = null; // HTTPで起動
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
function connectToNPCManager() {
  const npcManagerUrl = process.env.NPC_MANAGER_URL || 'http://npc_manager:3003';
  console.log(`Connecting to NPC Manager at ${npcManagerUrl}...`);
}

async function startServer() {
  try {
    // Mediasoupワーカーを初期化
    await mediasoupService.initialize();
    console.log('Mediasoup service initialized');

    // npc_managerに接続
    connectToNPCManager();

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
                    roomId: roomId,
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

      // Consumer作成
      socket.on('consume', async (data: { transportId: string; producerId: string; rtpCapabilities: any }, callback) => {
        try {
          console.log(`🍽️ Client ${socket.id} consuming producer ${data.producerId}`);
          const result = await mediasoupService.consume(socket.id, data.producerId, data.rtpCapabilities);
          if (result) {
            callback(result);
          } else {
            callback({ error: 'Cannot consume this producer' });
          }
        } catch (error: any) {
          console.error('❌ Error consuming:', error);
          callback({ error: error?.message || 'Failed to consume' });
        }
      });

      // Consumer再開
      socket.on('resume-consumer', async (data: { consumerId: string }, callback) => {
        try {
          console.log(`▶️ Client ${socket.id} resuming consumer ${data.consumerId}`);
          await mediasoupService.resumeConsumer(data.consumerId);
          callback({ success: true });
        } catch (error: any) {
          console.error('❌ Error resuming consumer:', error);
          callback({ error: error?.message || 'Failed to resume consumer' });
        }
      });

      // Consumer一時停止
      socket.on('pause-consumer', async (data: { consumerId: string }, callback) => {
        try {
          console.log(`⏸️ Client ${socket.id} pausing consumer ${data.consumerId}`);
          await mediasoupService.pauseConsumer(data.consumerId);
          callback({ success: true });
        } catch (error: any) {
          console.error('❌ Error pausing consumer:', error);
          callback({ error: error?.message || 'Failed to pause consumer' });
        }
      });

      // GamePong42ゲーム状態の送受信
      socket.on('gamepong42-send-state', (data: { roomNumber: string; gameState: any }) => {
        console.log(`🎮 Client ${socket.id} sending game state to room ${data.roomNumber}`);
        // 同じ部屋の他の参加者に状態を転送
        socket.to(`gamepong42-${data.roomNumber}`).emit('gamepong42-state', {
          senderId: socket.id,
          gameState: data.gameState,
          timestamp: Date.now()
        });
      });

      // データプロデューサー作成
      socket.on('produce-data', async (data: { transportId: string; sctpStreamParameters: any; label: string; protocol: string }, callback) => {
        try {
          console.log(`📊 Client ${socket.id} producing data with label: ${data.label}`);
          const result = await mediasoupService.produceData(socket.id, data.sctpStreamParameters, data.label, data.protocol);
          callback(result);
        } catch (error: any) {
          console.error('❌ Error producing data:', error);
          callback({ error: error?.message || 'Failed to produce data' });
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
