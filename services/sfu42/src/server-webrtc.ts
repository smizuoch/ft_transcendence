import Fastify from 'fastify';
import cors from '@fastify/cors';
import axios from 'axios';
import { GamePong42Manager } from './game-pong42-manager';
import { MediasoupService } from './mediasoup-service';
import { GamePong42WebRTCRoomManager } from './webrtc-room-manager';
import * as fs from 'fs';
import * as path from 'path';

// WebRTC専用サーバー - Socket.IOは削除してWebRTCのみ使用

// GamePong42マネージャーとWebRTCサービスのインスタンスを作成
const gamePong42Manager = new GamePong42Manager();
const mediasoupService = new MediasoupService();
const webrtcRoomManager = new GamePong42WebRTCRoomManager(mediasoupService, gamePong42Manager);

// MediasoupServiceを初期化
mediasoupService.initialize().then(() => {
  console.log('✅ Mediasoup service initialized');
}).catch((error) => {
  console.error('❌ Failed to initialize Mediasoup service:', error);
  process.exit(1);
});

// 定期的なクリーンアップ処理（30秒間隔）
setInterval(() => {
  gamePong42Manager.periodicCleanup();
}, 30000);

// NPC Manager URL for proxy requests
const NPC_MANAGER_URL = process.env.NPC_MANAGER_URL || 'http://npc_manager:3003';

// SSL証明書の設定
const getSSLOptions = () => {
  const certDirs = ['/app/internal-certs', '/app/certs', '/certs', './certs'];

  for (const certDir of certDirs) {
    // 証明書ディレクトリの存在確認
    if (!fs.existsSync(certDir)) {
      continue;
    }

    try {
      // 共通証明書のパス
      const keyPath = path.join(certDir, 'server.key');
      const certPath = path.join(certDir, 'server.crt');

      // まず共通証明書を試す
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const keyContent = fs.readFileSync(keyPath);
        const certContent = fs.readFileSync(certPath);
        return {
          key: keyContent,
          cert: certContent
        };
      }
    } catch (error) {
      continue;
    }
  }

  return null;
};

// WebRTC専用サーバー開始
const start = async () => {
  try {
    const sslOptions = getSSLOptions();

    if (!sslOptions) {
      console.error('❌ SSL certificates not found');
      process.exit(1);
    }

    console.log('🔒 SSL certificates loaded successfully');

    // HTTPS対応のFastifyサーバーを作成
    const fastify = Fastify({
      logger: {
        level: 'info'
      },
      https: sslOptions
    });

    // CORS設定
    fastify.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    // WebRTC API routes
    fastify.get('/api/webrtc/router-capabilities', async (request: any, reply: any) => {
      try {
        const capabilities = await mediasoupService.getRouterCapabilities();
        reply.send(capabilities);
      } catch (error) {
        reply.status(500).send({ error: 'Failed to get router capabilities' });
      }
    });

    fastify.post('/api/webrtc/create-send-transport', async (request: any, reply: any) => {
      try {
        const { roomNumber } = request.body;
        const transport = await mediasoupService.createWebRtcTransport();
        reply.send({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        });
      } catch (error) {
        reply.status(500).send({ error: 'Failed to create send transport' });
      }
    });

    fastify.post('/api/webrtc/connect-transport', async (request: any, reply: any) => {
      try {
        const { transportId, dtlsParameters } = request.body;
        await mediasoupService.connectTransport(transportId, dtlsParameters);
        reply.send({ success: true });
      } catch (error) {
        reply.status(500).send({ error: 'Failed to connect transport' });
      }
    });

    fastify.post('/api/webrtc/produce', async (request: any, reply: any) => {
      try {
        const { transportId, kind, rtpParameters, appData } = request.body;
        const producer = await mediasoupService.createProducer(transportId, kind, rtpParameters, appData);
        reply.send({ id: producer.id });
      } catch (error) {
        reply.status(500).send({ error: 'Failed to create producer' });
      }
    });

    fastify.post('/api/webrtc/join-gamepong42-room', async (request: any, reply: any) => {
      try {
        const { roomNumber, playerInfo } = request.body;
        const result = await webrtcRoomManager.joinRoom('temp-socket-id', roomNumber);
        reply.send({
          roomNumber: result.id,
          participantCount: result.participantCount,
          isRoomLeader: result.participantCount === 1,
          gameStarted: result.gameStarted
        });
      } catch (error) {
        reply.status(500).send({ error: 'Failed to join room' });
      }
    });

    // NPC Manager連携
    fastify.post('/api/webrtc/npc-request', async (request: any, reply: any) => {
      try {
        const { roomNumber, npcCount } = request.body;

        // NPC Managerに直接リクエスト
        const response = await axios.post(`${NPC_MANAGER_URL}/gamepong42/request-npcs`, {
          roomNumber,
          npcCount,
          sfuServerUrl: `https://${request.headers.host}`
        });

        reply.send(response.data);
      } catch (error) {
        console.error('Error requesting NPCs:', error);
        reply.status(500).send({ error: 'Failed to request NPCs' });
      }
    });

    // ヘルスチェック
    fastify.get('/health', async (request, reply) => {
      reply.send({ status: 'ok', service: 'sfu42-webrtc', timestamp: Date.now() });
    });

    await fastify.listen({ port: 3042, host: '0.0.0.0' });
    console.log('🚀 WebRTC SFU Server listening on port 3042 (HTTPS)');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();
