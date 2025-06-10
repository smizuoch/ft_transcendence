import Fastify from 'fastify';
import cors from '@fastify/cors';
import { NPCGameManager } from './gameManager';
import { GameConfig } from './types';

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
