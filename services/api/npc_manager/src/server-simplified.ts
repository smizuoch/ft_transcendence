// Simplified NPC Manager - WebRTC implementation pending
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { NPCGameManager } from './gameManager';
import { GameConfig } from './types';

// SFU接続用の型定義
interface SFURoomRequest {
  roomNumber: string;
  npcCount: number;
  sfuServerUrl: string;
}

interface NPCRoomData {
  roomNumber: string;
  npcCount: number;
  gameInstances: string[];
  // WebRTC connection will be implemented later
}

const fastify = Fastify({
  logger: {
    level: 'info'
  }
});

// CORS設定 - frontendからのアクセスのみ許可
fastify.register(cors, {
  origin: true, // 開発環境用に全許可
  credentials: true
});

const gameManager = new NPCGameManager();

// 部屋ごとのNPCデータを管理
const roomNPCs = new Map<string, NPCRoomData>();

// stopRoomNPCs関数の実装
function stopRoomNPCs(roomNumber: string): { success: boolean; message: string; roomNumber?: string; npcCount?: number } {
  try {
    const roomData = roomNPCs.get(roomNumber);

    if (!roomData) {
      return {
        success: false,
        message: `No NPCs found for room ${roomNumber}`
      };
    }

    // GameManagerからNPCインスタンスを停止
    roomData.gameInstances.forEach(gameId => {
      gameManager.stopGame(gameId);
    });

    // 部屋データを削除
    roomNPCs.delete(roomNumber);

    return {
      success: true,
      message: `Stopped ${roomData.npcCount} NPCs for room ${roomNumber}`,
      roomNumber,
      npcCount: roomData.npcCount
    };
  } catch (error) {
    console.error('Error stopping room NPCs:', error);
    return {
      success: false,
      message: `Failed to stop NPCs for room ${roomNumber}: ${error}`
    };
  }
}

// NPCの部屋作成処理（簡易版）
async function handleNPCRoomCreation(roomNumber: string, npcCount: number, sfuServerUrl: string): Promise<{ success: boolean; message: string; npcInstances?: string[] }> {
  try {
    if (npcCount === 0) {
      return {
        success: true,
        message: 'No NPCs needed',
        npcInstances: []
      };
    }

    const gameInstances: string[] = [];

    // NPCゲームインスタンスを作成
    for (let i = 0; i < npcCount; i++) {
      const gameConfig: GameConfig = {
        // Default NPC configuration
        canvasWidth: 800,
        canvasHeight: 600,
        paddleWidthRatio: 0.1,
        paddleHeightRatio: 0.015,
        ballRadiusRatio: 0.02,
        paddleSpeed: 10,
        initialBallSpeed: 0.3,
        maxBallSpeed: 2.0,
        winningScore: 999999,
        npc: {
          enabled: true,
          player: 1,
          mode: 'pid',
          reactionDelay: 0.1,
          positionNoise: 5,
          followGain: 0.8,
          returnRate: 0.65,
          reactionDelayMs: 350,
          maxSpeed: 0.55,
          trackingNoise: 15,
          trackingTimeout: 4000,
          difficulty: 'Easy',
          pid: {
            kp: 0.70,
            ki: 0.08,
            kd: 0.03,
            maxIntegral: 60,
            derivativeFilter: 0.25,
            maxControlSpeed: 450,
          },
          technician: {
            predictionAccuracy: 0.65,
            courseAccuracy: 0.55,
          },
        },
        npc2: {
          enabled: true,
          player: 2,
          mode: 'pid',
          reactionDelay: 0.05,
          positionNoise: 2,
          followGain: 0.99,
          returnRate: 0.99,
          reactionDelayMs: 50,
          maxSpeed: 1.2,
          trackingNoise: 2,
          trackingTimeout: 10000,
          difficulty: 'Nightmare',
          pid: {
            kp: 1.50,
            ki: 0.04,
            kd: 0.15,
            maxIntegral: 120,
            derivativeFilter: 0.25,
            maxControlSpeed: 450,
          },
          technician: {
            predictionAccuracy: 0.95,
            courseAccuracy: 0.95,
          },
        },
      };

      const gameId = gameManager.createGame(gameConfig);
      if (gameId) {
        gameInstances.push(gameId);
      }
    }

    // 部屋データを保存
    roomNPCs.set(roomNumber, {
      roomNumber,
      npcCount,
      gameInstances
    });

    return {
      success: true,
      message: `Created ${npcCount} NPCs for room ${roomNumber}`,
      npcInstances: gameInstances
    };

  } catch (error) {
    console.error('Error creating NPC room:', error);
    return {
      success: false,
      message: `Failed to create NPCs: ${error}`
    };
  }
}

// 基本的なヘルスチェック
fastify.get('/health', async (request, reply) => {
  reply.send({
    status: 'ok',
    service: 'npc-manager',
    timestamp: Date.now()
  });
});

// 部屋のNPCを停止するエンドポイント
fastify.post('/api/stop-room', async (request: any, reply: any) => {
  try {
    const { roomId } = request.body;

    if (!roomId) {
      reply.status(400).send({
        success: false,
        error: 'roomId is required'
      });
      return;
    }

    const result = stopRoomNPCs(roomId);

    if (result.success) {
      reply.send({
        success: true,
        message: result.message
      });
    } else {
      reply.status(404).send({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error stopping room NPCs:', error);
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to stop room NPCs'
    });
  }
});

// GamePong42専用エンドポイント - NPCリクエスト処理
fastify.post('/gamepong42/request-npcs', async (request: any, reply: any) => {
  try {
    const { roomNumber, npcCount } = request.body;

    if (!roomNumber || typeof npcCount !== 'number' || npcCount < 0) {
      reply.status(400).send({
        success: false,
        error: 'Invalid request parameters'
      });
      return;
    }

    // NPC数が0の場合（42人満員）は処理をスキップ
    if (npcCount === 0) {
      reply.send({
        success: true,
        message: `Room ${roomNumber} is full (42 participants), no NPCs created`,
        roomNumber,
        npcCount: 0
      });
      return;
    }

    // GamePong42用のNPCゲームを作成
    await handleNPCRoomCreation(roomNumber, npcCount, 'https://sfu42:3042');

    reply.send({
      success: true,
      message: `Created ${npcCount} NPCs for GamePong42 room ${roomNumber}`,
      roomNumber,
      npcCount
    });
  } catch (error) {
    console.error('❌ Error handling GamePong42 NPC request:', error);
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to create NPCs for GamePong42'
    });
  }
});

// サーバー起動
const start = async () => {
  try {
    await fastify.listen({ port: 3003, host: '0.0.0.0' });
    console.log('🚀 NPC Manager Server listening on port 3003');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();
