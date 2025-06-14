import fastify from 'fastify';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MediasoupService } from './mediasoup-service';
import { RoomManager } from './room-manager';
import { TournamentManager } from './tournament-manager';
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

// MediasoupとRoomManagerとTournamentManagerのインスタンス
const mediasoupService = new MediasoupService();
const roomManager = new RoomManager();
const tournamentManager = new TournamentManager();

// 部屋の参加者を追跡するためのMap（Room Leader判定用）
const roomParticipants = new Map<string, Set<string>>();

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

        // GamePong42部屋からプレイヤーを削除
        for (const [roomKey, participants] of roomParticipants.entries()) {
          if (participants.has(socket.id)) {
            participants.delete(socket.id);
            console.log(`Player ${socket.id} removed from ${roomKey} (${participants.size} participants remaining)`);

            // 他の参加者に通知
            socket.to(roomKey).emit('gamepong42-participant-left', {
              playerId: socket.id,
              participantCount: participants.size
            });

            // 部屋が空になったら削除
            if (participants.size === 0) {
              roomParticipants.delete(roomKey);
              console.log(`Empty room ${roomKey} deleted`);
            }
            break;
          }
        }

        // プレイヤーを全ての部屋から削除
        const roomNumber = roomManager.removePlayer(socket.id);
        if (roomNumber) {
          console.log(`Player ${socket.id} left room ${roomNumber}`);
          socket.to(roomNumber).emit('player-left', {
            playerId: socket.id
          });
        }

      });

      // WebRTCデータの中継（ゲーム状態やプレイヤー入力の中継）
      socket.on('gamepong42-data', (data: { roomNumber: string; payload: any }) => {
        console.log(`🔄 Relaying GamePong42 data from ${socket.id} to room ${data.roomNumber}`);
        // データを同じ部屋の他のクライアントに中継
        socket.to(`gamepong42-${data.roomNumber}`).emit('gamepong42-data', {
          senderId: socket.id,
          payload: data.payload
        });
      });

      // WebRTC部屋への参加（データ中継のみ）
      socket.on('join-gamepong42-room', async (data: { roomNumber: string; playerInfo: any }) => {
        try {
          console.log(`🏠 Player ${socket.id} joining GamePong42 room for data relay:`, data);

          const { roomNumber } = data;
          const roomKey = `gamepong42-${roomNumber}`;

          // 部屋の参加者リストを初期化（存在しない場合）
          if (!roomParticipants.has(roomKey)) {
            roomParticipants.set(roomKey, new Set());
          }

          const participants = roomParticipants.get(roomKey)!;
          const isFirstPlayer = participants.size === 0;

          // 参加者を追加
          participants.add(socket.id);
          await socket.join(roomKey);

          console.log(`✅ Player ${socket.id} joined GamePong42 data relay room ${roomNumber} (${participants.size} participants)`);

          // 参加確認を送信（Room Leader情報を含む）
          socket.emit('gamepong42-room-joined', {
            roomNumber: roomNumber,
            message: 'Ready for data relay',
            participantCount: participants.size,
            isFirstPlayer: isFirstPlayer
          });

          // 他のクライアントに新しい参加者を通知
          socket.to(roomKey).emit('gamepong42-participant-joined', {
            playerId: socket.id,
            participantCount: participants.size
          });

        } catch (error) {
          console.error('❌ Error joining GamePong42 room:', error);
          socket.emit('gamepong42-room-error', {
            error: 'Failed to join room for data relay'
          });
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
