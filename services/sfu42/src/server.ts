import Fastify from 'fastify';
import { Server } from 'socket.io';
import cors from '@fastify/cors';
import axios from 'axios';
import { GamePong42Manager } from './game-pong42-manager';
import * as fs from 'fs';
import * as path from 'path';

// GamePong42マネージャーのインスタンスを作成
const gamePong42Manager = new GamePong42Manager();

// 定期的なクリーンアップ処理（30秒間隔）
setInterval(() => {
  gamePong42Manager.periodicCleanup();
}, 30000);

// Types for data relay only - no state management
interface GameCanvasData {
  canvasId: string;
  timestamp: number;
  gameState: {
    ballX: number;
    ballY: number;
    ballVelX: number;
    ballVelY: number;
    leftPaddle: number;
    rightPaddle: number;
    leftScore: number;
    rightScore: number;
    gameActive: boolean;
    gameEnded?: boolean;
    winner?: 'left' | 'right';
  };
}

// Simple room tracking for relay purposes only
const roomConnections = new Map<string, Set<string>>();
const roomLeaders = new Map<string, string>(); // Track room leaders

// Room game state tracking (for new player sync)
const roomGameStates = new Map<string, { gameStarted: boolean; timestamp: number }>();

// プレイヤーゲーム状態中継の統計
const playerGameStateStats = new Map<string, { count: number, lastUpdate: number }>();

// 1秒ごとに統計をリセット
setInterval(() => {
  for (const [roomNumber, stats] of playerGameStateStats.entries()) {
    stats.count = 0; // リセット
  }
}, 1000);

// NPC Manager URL for proxy requests
const NPC_MANAGER_URL = process.env.NPC_MANAGER_URL || 'http://npc_manager:3003';

// SSL証明書の設定（SFUサービスから移植）
const getSSLOptions = () => {
  const certDirs = ['/app/internal-certs', '/app/certs', '/certs', './certs'];

  for (const certDir of certDirs) {
    // 証明書ディレクトリの存在確認
    if (!fs.existsSync(certDir)) {
      continue;
    }

    // ディレクトリの内容を表示
    try {
      const files = fs.readdirSync(certDir);

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

  // 自己署名証明書を生成
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

    return {
      key: keyContent,
      cert: certContent
    };
  } catch (error: any) {
    console.error('Error generating self-signed certificate:', error?.message || error);
  }
  return null;
};

const sslOptions = getSSLOptions();

// SSL証明書が必須なのでHTTPS/WSSを強制
if (!sslOptions) {
  console.error('❌ SSL certificates are required for HTTPS/WSS operation');
  console.error('Cannot start server without valid SSL certificates');
  console.error('SFU servers must use HTTPS/WSS for WebRTC functionality');
  process.exit(1);
}

// npc_managerのエミュレーションを停止する関数
async function stopNPCManagerEmulation(roomId: string): Promise<void> {
  try {
    const response = await axios.post(`${NPC_MANAGER_URL}/api/stop-room`, {
      roomId: roomId
    }, {
      timeout: 5000
    });
  } catch (error) {
    // Silently fail
  }
}

// FastifyとSocket.IOサーバーを作成（HTTPS対応）
const fastify = Fastify({
  logger: {
    level: 'info'
  },
  https: sslOptions // HTTPS強制
});

// CORS設定
fastify.register(cors, {
  origin: true,
  credentials: true
});

const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket'], // WebSocketのみ使用（polling無効化）
  allowEIO3: false, // 最新のEngine.IOのみ使用
  serveClient: false, // クライアントファイル配信無効
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.IO handlers - Pure data relay only
io.on('connection', (socket) => {
  // Join room - Only for routing purposes
  socket.on('join-room', (data) => {
    const { roomNumber, userId } = data;

    // Leave any existing rooms
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
        // Remove from room tracking
        const roomSet = roomConnections.get(room);
        if (roomSet) {
          roomSet.delete(socket.id);
          if (roomSet.size === 0) {
            roomConnections.delete(room);
            roomLeaders.delete(room); // Remove leader when room is empty
            roomGameStates.delete(room); // Clean up game state
          } else if (roomLeaders.get(room) === socket.id) {
            // If leaving player is leader, assign new leader
            const newLeader = Array.from(roomSet)[0];
            roomLeaders.set(room, newLeader);
          }
        }
      }
    });

    // Join the new room
    socket.join(roomNumber);

    // Add to room tracking
    if (!roomConnections.has(roomNumber)) {
      roomConnections.set(roomNumber, new Set());
    }

    const roomSet = roomConnections.get(roomNumber)!;
    const wasEmpty = roomSet.size === 0;
    roomSet.add(socket.id);

    // Set room leader if this is the first player
    if (wasEmpty) {
      roomLeaders.set(roomNumber, socket.id);
    }

    const currentPlayerCount = roomSet.size;
    const isRoomLeader = roomLeaders.get(roomNumber) === socket.id;

    // Send join confirmation to the joining player with leader status
    socket.emit('room-join-confirmed', {
      roomNumber,
      isRoomLeader,
      participantCount: currentPlayerCount,
      timestamp: Date.now()
    });

    // Check if game is already started and notify new participant
    const roomGameState = roomGameStates.get(roomNumber);
    if (roomGameState && roomGameState.gameStarted) {
      socket.emit('game-start', {
        playerCount: currentPlayerCount,
        npcCount: Math.max(0, 42 - currentPlayerCount),
        from: 'server',
        timestamp: roomGameState.timestamp,
        alreadyStarted: true
      });
    }

    // Notify all OTHER clients in the room about the new player
    socket.to(roomNumber).emit('player-joined', {
      socketId: socket.id,
      userId,
      participantCount: currentPlayerCount,
      timestamp: Date.now()
    });
  });

  // Pure data relay - Room Leader countdown
  socket.on('room-leader-countdown', (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomNumber) {
      socket.to(roomNumber).emit('room-leader-countdown', {
        ...data,
        from: socket.id,
        timestamp: Date.now()
      });
    }
  });

  // Pure data relay - Game start
  socket.on('game-start', (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomNumber) {
      // Record room game state for future participants
      roomGameStates.set(roomNumber, { gameStarted: true, timestamp: Date.now() });

      socket.to(roomNumber).emit('game-start', {
        ...data,
        from: socket.id,
        timestamp: Date.now()
      });
    }
  });

  // Pure data relay - Game canvas data
  socket.on('game-canvas-data', (data: GameCanvasData) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomNumber) {
      // Relay to all other clients in the room
      socket.to(roomNumber).emit('game-canvas-data', data);
    }
  });

  // Pure data relay - Player game state
  // デバッグ: すべてのイベントをキャッチ
  socket.onAny((eventName, ...args) => {
    // Removed verbose logging
  });

  // クライアント接続時のルーム参加確認
  socket.on('join-gamepong42-room', (data) => {
    const { roomNumber, playerInfo } = data;

    // npc_managerからの接続の場合は特別に処理
    if (playerInfo?.isNPCManager) {
      // npc_managerを直接指定されたルームに参加させる
      socket.join(roomNumber);

      // Add to room tracking
      if (!roomConnections.has(roomNumber)) {
        roomConnections.set(roomNumber, new Set());
      }
      roomConnections.get(roomNumber)!.add(socket.id);

      // Confirm join to NPC Manager
      socket.emit('gamepong42-room-joined', {
        roomNumber,
        timestamp: Date.now()
      });

      return; // npc_managerの場合はここで処理終了
    }

    // GamePong42マネージャーを使用して適切な部屋を取得
    try {
      const room = gamePong42Manager.getAvailableRoom();
      const actualRoomNumber = room.id;

      // 部屋に参加者を追加
      room.addParticipant(socket.id, playerInfo);

      // 部屋のゲーム状態更新コールバックを設定
      room.onGameStateUpdate = (update) => {
        socket.to(actualRoomNumber).emit('gamepong42-update', update);
      };

      // npc_manager停止コールバックを設定
      room.onStopNPCManager = (roomId) => {
        stopNPCManagerEmulation(roomId);
      };

      // 既存のjoin-room処理と同じ処理を実行
      // Leave any existing rooms
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
          // Remove from room tracking
          const roomSet = roomConnections.get(room);
          if (roomSet) {
            roomSet.delete(socket.id);
            if (roomSet.size === 0) {
              roomConnections.delete(room);
              roomLeaders.delete(room);
              roomGameStates.delete(room);
            } else if (roomLeaders.get(room) === socket.id) {
              const newLeader = Array.from(roomSet)[0];
              roomLeaders.set(room, newLeader);
            }
          }
        }
      });

      // Join the new room
      socket.join(actualRoomNumber);

      // Add to room tracking
      if (!roomConnections.has(actualRoomNumber)) {
        roomConnections.set(actualRoomNumber, new Set());
      }

      const roomSet = roomConnections.get(actualRoomNumber)!;
      const wasEmpty = roomSet.size === 0;
      roomSet.add(socket.id);

      // Set room leader if this is the first player
      if (wasEmpty) {
        roomLeaders.set(actualRoomNumber, socket.id);
      }

      const currentPlayerCount = roomSet.size;
      const isRoomLeader = roomLeaders.get(actualRoomNumber) === socket.id;

      // Send join confirmation to the joining player with leader status
      socket.emit('room-join-confirmed', {
        roomNumber: actualRoomNumber,
        isRoomLeader,
        participantCount: currentPlayerCount,
        countdown: room.countdown,
        gameStarted: room.gameStarted,
        timestamp: Date.now()
      });

      // Notify all OTHER clients in the room about the new player
      socket.to(actualRoomNumber).emit('player-joined', {
        socketId: socket.id,
        userId: playerInfo?.name || 'unknown',
        participantCount: currentPlayerCount,
        timestamp: Date.now()
      });

      // 新規参加者に既存の参加者リストを送信
      const existingClients = Array.from(roomSet).filter(id => id !== socket.id);
      if (existingClients.length > 0) {
        socket.emit('existing-players-list', {
          roomNumber: actualRoomNumber,
          existingClients,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      socket.emit('room-join-error', {
        error: 'Failed to join room',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  socket.on('player-game-state', (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomNumber) {
      // 統計をカウント
      if (!playerGameStateStats.has(roomNumber)) {
        playerGameStateStats.set(roomNumber, { count: 0, lastUpdate: Date.now() });
      }
      playerGameStateStats.get(roomNumber)!.count++;

      const clientsInRoom = roomConnections.get(roomNumber)?.size || 0;

      // 送信者以外の全クライアントに中継
      socket.to(roomNumber).emit('player-game-state-relay', {
        ...data,
        timestamp: Date.now()
      });

      // デバッグログ（100回に1回で詳細ログ）
      const stats = playerGameStateStats.get(roomNumber)!;
      if (stats.count % 100 === 1) {
        // Reduced detailed logging
      }
    }
  });

  // Pure data relay - Player input
  socket.on('player-input', (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomNumber) {
      socket.to(roomNumber).emit('player-input', {
        ...data,
        from: socket.id,
        timestamp: Date.now()
      });
    }
  });

  // Pure data relay - Player game over
  socket.on('player-game-over', (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomNumber) {
      socket.to(roomNumber).emit('player-game-over', {
        ...data,
        from: socket.id,
        timestamp: Date.now()
      });
    }
  });

  // Pure data relay - Chat messages
  socket.on('chat-message', (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomNumber) {
      socket.to(roomNumber).emit('chat-message', {
        ...data,
        from: socket.id,
        timestamp: Date.now()
      });
    }
  });

  // Pure data relay - Generic data relay
  socket.on('relay-data', (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (roomNumber) {
      socket.to(roomNumber).emit('relay-data', {
        ...data,
        from: socket.id,
        timestamp: Date.now()
      });
    }
  });

  // Pure data relay - GamePong42 data (including NPC states)
  socket.on('gamepong42-data', (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);

    if (roomNumber) {
      // Relay to all clients in the room (including sender for verification)
      io.to(roomNumber).emit('gamepong42-data', {
        ...data,
        from: socket.id,
        relayTimestamp: Date.now()
      });
    }
  });

  // NPC Request relay - クライアント→SFU→npc_manager
  socket.on('npc-request', async (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (!roomNumber) {
      socket.emit('npc-response', { error: 'Not in a room' });
      return;
    }

    try {
      // npc_managerにHTTPリクエストを中継
      const npcResponse = await axios.post(`${NPC_MANAGER_URL}/api/npc/request-via-sfu`, {
        ...data,
        roomNumber,
        requesterId: socket.id,
        sfuServerUrl: `https://sfu42:3042` // SFU自身のURL
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-SFU-Request': 'true', // SFU経由のリクエストを示すヘッダー
        }
      });

      // レスポンスをクライアントに返す
      socket.emit('npc-response', {
        success: true,
        requestId: data.requestId, // クライアントでレスポンス識別に使用
        data: npcResponse.data,
        timestamp: Date.now()
      });

      // 必要に応じて他のクライアントにも通知（NPCの参加・退出など）
      if (data.type === 'join' || data.type === 'leave') {
        socket.to(roomNumber).emit('npc-status-update', {
          roomNumber,
          npcCount: npcResponse.data.npcCount,
          from: socket.id,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      socket.emit('npc-response', {
        success: false,
        requestId: data.requestId, // エラーレスポンスにもrequestIdを含める
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  // Disconnect handler - Only cleanup routing
  socket.on('disconnect', () => {
    // GamePong42の部屋から参加者を削除
    gamePong42Manager.getAllRooms().forEach(room => {
      if (room.hasParticipant(socket.id)) {
        room.removeParticipant(socket.id);
      }
    });

    // Clean up room connections
    for (const [roomNumber, connectionSet] of roomConnections.entries()) {
      if (connectionSet.has(socket.id)) {
        const wasLeader = roomLeaders.get(roomNumber) === socket.id;
        connectionSet.delete(socket.id);

        // Notify other clients about disconnect
        socket.to(roomNumber).emit('player-left', {
          socketId: socket.id,
          participantCount: connectionSet.size,
          timestamp: Date.now()
        });

        // Remove empty rooms
        if (connectionSet.size === 0) {
          roomConnections.delete(roomNumber);
          roomLeaders.delete(roomNumber);
          roomGameStates.delete(roomNumber);
        } else {
          // If the disconnected player was the leader, assign new leader
          if (wasLeader) {
            const newLeader = Array.from(connectionSet)[0];
            roomLeaders.set(roomNumber, newLeader);

            // Notify the new leader
            io.to(newLeader).emit('room-leader-assigned', {
              roomNumber,
              isRoomLeader: true,
              participantCount: connectionSet.size,
              timestamp: Date.now()
            });
          }
        }
        break;
      }
    }
  });
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    rooms: roomConnections.size,
    totalConnections: Array.from(roomConnections.values()).reduce((sum, connections) => sum + connections.size, 0)
  };
});

// Simple room info endpoint - Only connection count
fastify.get('/rooms/:roomNumber/info', async (request, reply) => {
  const { roomNumber } = request.params as { roomNumber: string };
  const connections = roomConnections.get(roomNumber);

  return {
    roomNumber,
    connectionCount: connections ? connections.size : 0,
    exists: !!connections
  };
});

// Start server
const start = async () => {
  try {
    const PORT = parseInt(process.env.PORT || '3042');
    const protocol = sslOptions ? 'HTTPS' : 'HTTP';

    // Socket.IOをFastifyサーバーに接続（サーバー起動前）
    io.attach(fastify.server);

    // Fastifyサーバーを起動
    await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
