import Fastify from 'fastify';
import cors from '@fastify/cors';
import { NPCGameManager } from './gameManager';
import { GameConfig } from './types';
import { io as SocketIOClient, Socket } from 'socket.io-client';

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

// SFUサーバーへの接続
let sfuSocket: Socket | null = null;
const sfuUrl = process.env.SFU_URL || 'http://sfu:3001';

// SFUサーバーに接続
function connectToSFU() {
  console.log(`Connecting to SFU server at ${sfuUrl}...`);

  sfuSocket = SocketIOClient(sfuUrl, {
    transports: ['websocket', 'polling']
  });

  sfuSocket.on('connect', () => {
    console.log('Connected to SFU server');
  });

  sfuSocket.on('disconnect', () => {
    console.log('Disconnected from SFU server');
  });

  sfuSocket.on('request-npc', (data: { roomNumber: string; npcCount: number }) => {
    console.log(`SFU requested ${data.npcCount} NPCs for room ${data.roomNumber}`);
    handleNPCRequest(data.roomNumber, data.npcCount);
  });

  sfuSocket.on('error', (error: any) => {
    console.error('SFU connection error:', error);
  });
}

// NPCリクエストを処理
async function handleNPCRequest(roomNumber: string, npcCount: number) {
  console.log(`Creating ${npcCount} NPCs for GamePong42 room ${roomNumber}`);

  const npcGames: Array<{ gameId: string; active: boolean }> = [];

  for (let i = 0; i < npcCount; i++) {
    try {
      const config: GameConfig = {
        winningScore: 11,
        canvasWidth: 100,
        canvasHeight: 100,
        paddleWidth: 10,
        paddleHeight: 15,
        ballRadius: 2,
        paddleSpeed: 6,
        initialBallSpeed: 1.0,
        maxBallSpeed: 2.5,
        npc: {
          enabled: true,
          player: 1,
          mode: 'pid',
          difficulty: 'Easy',
          reactionDelay: 0.1,
          positionNoise: 0.05,
          followGain: 0.8,
          returnRate: 0.9,
          reactionDelayMs: 100,
          maxSpeed: 4,
          trackingNoise: 0.1,
          trackingTimeout: 500
        },
        npc2: {
          enabled: true,
          player: 2,
          mode: 'pid',
          difficulty: 'Nightmare',
          reactionDelay: 0.02,
          positionNoise: 0.01,
          followGain: 1.0,
          returnRate: 0.95,
          reactionDelayMs: 20,
          maxSpeed: 8,
          trackingNoise: 0.02,
          trackingTimeout: 200
        }
      };

      const gameId = gameManager.createGame(config);
      npcGames.push({ gameId, active: true });
      console.log(`Created NPC game ${i + 1}/${npcCount} with ID: ${gameId}`);
    } catch (error) {
      console.error(`Failed to create NPC game ${i + 1}:`, error);
      npcGames.push({ gameId: '', active: false });
    }
  }

  // NPCゲーム状態を定期的にSFUに送信（60fps）
  const gameUpdateInterval = setInterval(() => {
    const npcStates = npcGames
      .filter(game => game.active && game.gameId)
      .map(game => {
        const gameState = gameManager.getGameState(game.gameId);
        return {
          gameId: game.gameId,
          gameState,
          active: gameState !== null
        };
      })
      .filter(state => state.active);

    if (sfuSocket && npcStates.length > 0) {
      sfuSocket.emit('npc-states-update', {
        roomNumber,
        npcStates
      });
    }

    // 全てのゲームが終了したらintervalを停止
    const activeGames = npcGames.filter(game => game.active);
    if (activeGames.length === 0) {
      clearInterval(gameUpdateInterval);
      console.log(`All NPC games for room ${roomNumber} have ended`);
    }
  }, 1000 / 60); // 60fps
}

// サーバー起動時にSFUに接続
connectToSFU();

// ヘルスチェック
fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeGames: gameManager.getActiveGameCount(),
    totalGames: gameManager.getGameCount()
  };
});

// デバッグエンドポイント
fastify.get('/debug', async () => {
  const gameCount = gameManager.getGameCount();
  const activeGameCount = gameManager.getActiveGameCount();
  console.log(`🔍 Debug info - Total games: ${gameCount}, Active games: ${activeGameCount}`);

  return {
    status: 'debug',
    timestamp: new Date().toISOString(),
    totalGames: gameCount,
    activeGames: activeGameCount,
    message: 'Debug info logged to console'
  };
});

// 新しいNPC vs NPCゲームを作成
fastify.post('/games', async (request: any, reply: any) => {
  try {
    const config = request.body || {};
    console.log('🎮 Creating new game with config:', config);
    const gameId = gameManager.createGame(config);
    console.log('✅ Game created successfully:', gameId);

    reply.status(201).send({
      success: true,
      gameId,
      message: 'NPC vs NPC game created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating game:', error);
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to create game'
    });
  }
});

// 特定のゲームの状態を取得
fastify.get('/games/:gameId', async (request: any, reply: any) => {
  try {
    const { gameId } = request.params;
    const gameState = gameManager.getGameState(gameId);

    if (!gameState) {
      reply.status(404).send({
        success: false,
        error: 'Game not found'
      });
      return;
    }

    reply.send({
      success: true,
      data: gameState
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to get game state'
    });
  }
});

// 全てのアクティブなゲームの状態を取得
fastify.get('/games', async (request: any, reply: any) => {
  try {
    const activeGames = gameManager.getAllActiveGames();

    reply.send({
      success: true,
      data: activeGames,
      count: activeGames.length
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to get games'
    });
  }
});

// ランダムなゲームにスピードブーストを適用
fastify.post('/speed-boost', async (request: any, reply: any) => {
  try {
    const { excludeGameId } = request.body || {};
    const success = gameManager.applySpeedBoostToRandomGame(excludeGameId);

    if (!success) {
      reply.status(404).send({
        success: false,
        error: 'No active games available for speed boost'
      });
      return;
    }

    reply.send({
      success: true,
      message: 'Speed boost applied to random game'
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to apply speed boost'
    });
  }
});

// 特定のゲームにスピードブーストを適用
fastify.post('/speed-boost/:gameId', async (request: any, reply: any) => {
  try {
    const { gameId } = request.params;
    const success = gameManager.applySpeedBoostToGame(gameId);

    if (!success) {
      reply.status(404).send({
        success: false,
        error: 'Game not found or not running'
      });
      return;
    }

    reply.send({
      success: true,
      message: 'Speed boost applied to game'
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to apply speed boost'
    });
  }
});

// 特定のゲームにスピードブーストを適用（代替パス）
fastify.post('/games/:gameId/speed-boost', async (request: any, reply: any) => {
  try {
    const { gameId } = request.params;
    const success = gameManager.applySpeedBoostToGame(gameId);

    if (!success) {
      reply.status(404).send({
        success: false,
        error: 'Game not found or not running'
      });
      return;
    }

    reply.send({
      success: true,
      message: 'Speed boost applied to game'
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to apply speed boost'
    });
  }
});

// ゲームを停止
fastify.delete('/games/:gameId', async (request: any, reply: any) => {
  try {
    const { gameId } = request.params;
    const success = gameManager.stopGame(gameId);

    if (!success) {
      reply.status(404).send({
        success: false,
        error: 'Game not found'
      });
      return;
    }

    reply.send({
      success: true,
      message: 'Game stopped successfully'
    });
  } catch (error) {
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to stop game'
    });
  }
});

// 統計情報を取得
fastify.get('/api/npc/stats', async () => {
  return {
    success: true,
    data: {
      totalGames: gameManager.getGameCount(),
      activeGames: gameManager.getActiveGameCount(),
      timestamp: new Date().toISOString()
    }
  };
});

// グレースフルシャットダウン
const gracefulShutdown = async () => {
  try {
    gameManager.shutdown();
    await fastify.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// サーバー起動
const start = async () => {
  try {
    const host = '0.0.0.0';
    const port = 3003;

    await fastify.listen({ port, host });
    console.log(`🚀 NPC Manager server running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();

// GamePong42専用エンドポイント - NPCリクエスト処理
fastify.post('/gamepong42/request-npcs', async (request: any, reply: any) => {
  try {
    const { roomNumber, npcCount } = request.body;
    console.log(`🎮 GamePong42 NPC request - Room: ${roomNumber}, NPCs: ${npcCount}`);

    if (!roomNumber || typeof npcCount !== 'number' || npcCount < 0) {
      reply.status(400).send({
        success: false,
        error: 'Invalid request parameters'
      });
      return;
    }

    // NPC数が0の場合（42人満員）は処理をスキップ
    if (npcCount === 0) {
      console.log(`Room ${roomNumber} has 42 participants, no NPCs needed`);
      reply.send({
        success: true,
        message: `Room ${roomNumber} is full (42 participants), no NPCs created`,
        roomNumber,
        npcCount: 0
      });
      return;
    }

    // GamePong42用のNPCゲームを作成してSFU経由で配信開始
    await handleNPCRequest(roomNumber, npcCount);

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
