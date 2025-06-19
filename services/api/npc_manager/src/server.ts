// WebRTC対応のため、Socket.IOインポートを削除
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { NPCGameManager } from './gameManager';
import { GameConfig } from './types';
// DataProducerはmediasoup-clientではなくmediasoupから提供される
// import { Device, DataProducer } from 'mediasoup-client';

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
  webrtcConnection: WebRTCConnection | null; // Socket.IOをWebRTCに変更
}

// WebRTC接続管理
interface WebRTCConnection {
  // device: Device | null;  // 型定義のみ保持
  // sendTransport: any | null;
  // dataProducer: DataProducer | null;
  roomNumber: string;
  connected: boolean;
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

// SFUサーバーへの接続
let defaultSfuSocket: Socket | null = null;
const defaultSfuUrl = 'https://sfu42:3042';

// WebRTC接続情報
const webrtcConnections = new Map<string, WebRTCConnection>();

// 特定の部屋用にSFUサーバーに接続
function connectToSFUForRoom(roomNumber: string, sfuServerUrl: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sfuSocket = SocketIOClient(sfuServerUrl, {
      transports: ['websocket'], // WebSocketのみ使用
      // HTTPS/WSS設定
      secure: true, // HTTPS/WSS強制
      timeout: 10000,
      // 自己署名証明書対応
      rejectUnauthorized: false,
      // 追加の設定
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false
    });

    sfuSocket.on('connect', () => {
      // SFU部屋に参加
      sfuSocket.emit('join-gamepong42-room', {
        roomNumber: roomNumber,
        playerInfo: {
          name: 'NPC_Manager',
          avatar: '/images/avatar/npc.png',
          isNPCManager: true
        }
      });

      resolve(sfuSocket);
    });

    sfuSocket.on('disconnect', () => {
      // 切断時の処理
    });

    sfuSocket.on('error', (error: any) => {
      console.error(`SFU connection error for room ${roomNumber}:`, error);
      reject(error);
    });

    sfuSocket.on('connect_error', (error: any) => {
      console.error(`Failed to connect to SFU for room ${roomNumber}:`, error);
      reject(error);
    });

    // タイムアウト処理
    setTimeout(() => {
      if (!sfuSocket.connected) {
        sfuSocket.disconnect();
        reject(new Error(`Connection timeout for room ${roomNumber}`));
      }
    }, 10000);
  });
}

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

    // SFU接続を切断（WebRTC）
    // if (roomData.webrtcConnection) {
    //   disconnectWebRTC(roomNumber);
    // }

    // WebRTC接続を切断
    const webrtcConnection = webrtcConnections.get(roomNumber);
    if (webrtcConnection) {
      disconnectWebRTC(roomNumber);
    }

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

// SFUサーバーに接続
function connectToDefaultSFU() {
  defaultSfuSocket = SocketIOClient(defaultSfuUrl, {
    transports: ['websocket'], // WebSocketのみ使用
    // HTTPS/WSS設定
    secure: true, // HTTPS/WSS強制
    // 自己署名証明書対応
    rejectUnauthorized: false,
    // 追加の設定
    forceNew: true,
    upgrade: true,
    rememberUpgrade: false
  });

  defaultSfuSocket.on('connect', () => {
    // 接続完了
  });

  defaultSfuSocket.on('disconnect', () => {
    // 切断時の処理
  });

  defaultSfuSocket.on('error', (error: any) => {
    console.error('Default SFU connection error:', error);
  });
}

// NPCの部屋作成処理
async function handleNPCRoomCreation(roomNumber: string, npcCount: number, sfuServerUrl: string): Promise<{ success: boolean; message: string; npcInstances?: string[] }> {
  try {
    if (npcCount === 0) {
      return {
        success: true,
        message: 'No NPCs needed',
        npcInstances: []
      };
    }

    // SFUサーバーに接続
    const sfuSocket = await connectToSFUForRoom(roomNumber, sfuServerUrl);

    // NPCゲームインスタンスを作成
    const gameInstances: string[] = [];

    for (let i = 0; i < npcCount; i++) {
      const gameConfig: Partial<GameConfig> = {
        canvasWidth: 100,
        canvasHeight: 100,
        paddleWidthRatio: 0.1, // キャンバス幅の10%
        paddleHeightRatio: 0.015, // キャンバス高さの1.5%
        ballRadiusRatio: 0.02, // キャンバス幅の2%
        paddleSpeed: 10, // パドル速度を10に変更
        initialBallSpeed: 0.3, // 初期ボール速度を0.3に変更
        maxBallSpeed: 2.0, // ボール最大速度を2.0に変更
        winningScore: 999999, // GamePong42用: 実質無制限
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
            derivativeFilter: 0.6,
            maxControlSpeed: 900,
          },
          technician: {
            predictionAccuracy: 0.95,
            courseAccuracy: 0.9,
          },
        },
      };

      const gameId = gameManager.createGame(gameConfig);
      gameInstances.push(gameId);
    }

    // 部屋データを保存
    roomNPCs.set(roomNumber, {
      roomNumber,
      npcCount,
      gameInstances,
      sfuSocket
    });

    // 60fpsでNPCデータをSFUに送信開始
    startNPCDataTransmission(roomNumber);

    return {
      success: true,
      message: `Created ${gameInstances.length} NPCs for room ${roomNumber}`,
      npcInstances: gameInstances
    };

  } catch (error: any) {
    console.error(`Error creating NPCs for room ${roomNumber}:`, error);
    return {
      success: false,
      message: error?.message || 'Failed to create NPCs'
    };
  }
}

// 60fpsでNPCデータをSFUに送信
function startNPCDataTransmission(roomNumber: string) {
  const roomData = roomNPCs.get(roomNumber);
  if (!roomData || !roomData.sfuSocket) {
    console.error(`No room data or SFU socket for room ${roomNumber}`);
    return;
  }

  const transmissionInterval = setInterval(() => {
    const roomData = roomNPCs.get(roomNumber);
    if (!roomData || !roomData.sfuSocket || !roomData.sfuSocket.connected) {
      clearInterval(transmissionInterval);
      return;
    }

    // 各NPCゲームの状態を取得して送信
    // 削除されたゲームIDを除去しながら状態を取得
    const npcStates = [];
    const activeGameIds = [];

    for (const gameId of roomData.gameInstances) {
      const gameState = gameManager.getGameState(gameId);
      if (gameState) {
        // ゲームが存在する場合のみ追加
        npcStates.push({
          gameId,
          gameState: gameState.gameState,
          active: gameState.isRunning
        });
        activeGameIds.push(gameId);
      }
    }

    // 削除されたゲームIDをgameInstancesから除去
    roomData.gameInstances = activeGameIds;

    // SFUを通じて全クライアントにNPCデータを送信
    roomData.sfuSocket.emit('gamepong42-data', {
      roomNumber: roomNumber,
      payload: {
        type: 'npcStates',
        npcStates: npcStates,
        timestamp: Date.now(),
        source: 'npc_manager'
      }
    });

  }, 1000 / 60); // 60fps
}

// WebRTC経由でSFUに接続
async function connectToSFUViaWebRTC(roomNumber: string, sfuServerUrl: string): Promise<boolean> {
  try {
    console.log(`🔗 Connecting to SFU via WebRTC for room ${roomNumber}`);

    const device = new Device();

    // ルーターのRTPキャパビリティを取得
    const response = await fetch(`${sfuServerUrl}/api/webrtc/router-capabilities`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get router capabilities: ${response.statusText}`);
    }

    const routerRtpCapabilities = await response.json();

    // デバイスをロード
    await device.load({ routerRtpCapabilities });

    // 送信トランスポートを作成
    const transportResponse = await fetch(`${sfuServerUrl}/api/webrtc/create-send-transport`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roomNumber })
    });

    if (!transportResponse.ok) {
      throw new Error(`Failed to create send transport: ${transportResponse.statusText}`);
    }

    const transportData = await transportResponse.json();
    const sendTransport = device.createSendTransport(transportData);

    // Transportのconnectとproduceイベントをハンドリング
    sendTransport.on('connect', async (params: any, callback: any, errback: any) => {
      try {
        await fetch(`${sfuServerUrl}/api/webrtc/connect-transport`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transportId: sendTransport.id,
            dtlsParameters: params.dtlsParameters,
            roomNumber
          })
        });
        callback();
      } catch (error) {
        errback(error);
      }
    });

    sendTransport.on('produce', async (params: any, callback: any, errback: any) => {
      try {
        const response = await fetch(`${sfuServerUrl}/api/webrtc/produce`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transportId: sendTransport.id,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
            appData: params.appData,
            roomNumber
          })
        });

        const { id } = await response.json();
        callback({ id });
      } catch (error) {
        errback(error);
      }
    });

    // DataProducerを作成
    const dataProducer = await sendTransport.produceData({
      ordered: false,
      appData: { type: 'npc-data' }
    });

    // WebRTC接続情報を保存
    webrtcConnections.set(roomNumber, {
      device,
      sendTransport,
      dataProducer,
      roomNumber,
      connected: true
    });

    console.log(`✅ WebRTC connection established for room ${roomNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to connect via WebRTC for room ${roomNumber}:`, error);
    return false;
  }
}

// WebRTC経由でNPCデータを送信
function sendNPCDataViaWebRTC(roomNumber: string, npcData: any): boolean {
  try {
    const connection = webrtcConnections.get(roomNumber);

    if (!connection || !connection.connected || !connection.dataProducer) {
      console.warn(`No WebRTC connection for room ${roomNumber}`);
      return false;
    }

    const message = JSON.stringify({
      type: 'npc-update',
      roomNumber,
      data: npcData,
      timestamp: Date.now()
    });

    connection.dataProducer.send(message);
    return true;
  } catch (error) {
    console.error(`Error sending NPC data via WebRTC for room ${roomNumber}:`, error);
    return false;
  }
}

// WebRTC接続を切断
async function disconnectWebRTC(roomNumber: string): Promise<void> {
  try {
    const connection = webrtcConnections.get(roomNumber);

    if (!connection) {
      return;
    }

    // DataProducerを閉じる
    if (connection.dataProducer) {
      connection.dataProducer.close();
    }

    // SendTransportを閉じる
    if (connection.sendTransport) {
      connection.sendTransport.close();
    }

    // 接続情報を削除
    webrtcConnections.delete(roomNumber);

    console.log(`🔌 WebRTC connection closed for room ${roomNumber}`);
  } catch (error) {
    console.error(`Error disconnecting WebRTC for room ${roomNumber}:`, error);
  }
}

// デフォルトSFUサーバーに接続
connectToDefaultSFU();

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
    const gameId = gameManager.createGame(config);

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
    console.log('✅ Shutdown completed');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
};

// サーバー起動
const start = async () => {
  try {
    const host = '0.0.0.0';
    const port = 3003;

    await fastify.listen({ port, host });
    console.log(`🚀 NPC Manager server running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
  }
};

start();

// SFU経由専用エンドポイント - クライアント→SFU→npc_manager
fastify.post('/api/npc/request-via-sfu', async (request: any, reply: any) => {
  try {
    // SFU経由のリクエストかどうかを確認
    const sfuHeader = request.headers['x-sfu-request'];
    if (!sfuHeader) {
      reply.status(403).send({
        success: false,
        error: 'Direct access not allowed. Must go through SFU.'
      });
      return;
    }

    const { type, roomNumber, npcCount, sfuServerUrl, requesterId, gameConfig, gameId } = request.body;

    if (!roomNumber || !type) {
      reply.status(400).send({
        success: false,
        error: 'Invalid request parameters'
      });
      return;
    }

    let result;

    switch (type) {
      case 'join':
        // NPCを部屋に追加
        if (typeof npcCount !== 'number' || npcCount < 0) {
          reply.status(400).send({
            success: false,
            error: 'Invalid npcCount for join request'
          });
          return;
        }

        if (npcCount === 0) {
          result = {
            success: true,
            message: `Room ${roomNumber} is full (42 participants), no NPCs created`,
            roomNumber,
            npcCount: 0
          };
        } else {
          await handleNPCRoomCreation(roomNumber, npcCount, sfuServerUrl || defaultSfuUrl);
          result = {
            success: true,
            message: `Created ${npcCount} NPCs for room ${roomNumber}`,
            roomNumber,
            npcCount
          };
        }
        break;

      case 'leave':
        // NPCを部屋から削除
        result = stopRoomNPCs(roomNumber);
        break;

      case 'status':
        // 部屋のNPC状態を取得
        const roomData = roomNPCs.get(roomNumber);
        result = {
          success: true,
          roomNumber,
          npcCount: roomData ? roomData.npcCount : 0,
          hasNPCs: !!roomData,
          gameInstances: roomData ? roomData.gameInstances.length : 0
        };
        break;

      case 'create-game':
        // 個別のNPCゲームを作成
        if (!gameConfig) {
          reply.status(400).send({
            success: false,
            error: 'Game config required for create-game request'
          });
          return;
        }

        try {
          const createdGameId = gameManager.createGame(gameConfig);
          result = {
            success: true,
            gameId: createdGameId,
            message: `Game ${createdGameId} created successfully`
          };
        } catch (error: any) {
          result = {
            success: false,
            error: `Failed to create game: ${error.message || error}`
          };
        }
        break;

      case 'speed-boost':
        // 特定のゲームにスピードブーストを適用
        if (!gameId) {
          reply.status(400).send({
            success: false,
            error: 'Game ID required for speed-boost request'
          });
          return;
        }

        try {
          const boostSuccess = gameManager.applySpeedBoostToGame(gameId);
          result = {
            success: boostSuccess,
            message: boostSuccess ? `Speed boost applied to game ${gameId}` : `Failed to apply speed boost to game ${gameId}`,
            gameId: gameId
          };
        } catch (error: any) {
          result = {
            success: false,
            error: `Failed to apply speed boost: ${error.message || error}`
          };
        }
        break;

      case 'stop-game':
        // 特定のゲームを停止
        if (!gameId) {
          reply.status(400).send({
            success: false,
            error: 'Game ID required for stop-game request'
          });
          return;
        }

        try {
          const stopSuccess = gameManager.stopGame(gameId);
          result = {
            success: stopSuccess,
            message: stopSuccess ? `Game ${gameId} stopped successfully` : `Failed to stop game ${gameId}`,
            gameId: gameId
          };
        } catch (error: any) {
          result = {
            success: false,
            error: `Failed to stop game: ${error.message || error}`
          };
        }
        break;

      default:
        reply.status(400).send({
          success: false,
          error: `Unknown request type: ${type}`
        });
        return;
    }

    reply.send(result);
  } catch (error) {
    console.error('❌ Error handling SFU relay request:', error);
    request.log.error(error);
    reply.status(500).send({
      success: false,
      error: 'Failed to process NPC request via SFU'
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

    // GamePong42用のNPCゲームを作成してSFU経由で配信開始
    await handleNPCRoomCreation(roomNumber, npcCount, defaultSfuUrl);

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
