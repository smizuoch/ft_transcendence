import Fastify from 'fastify';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from '@fastify/cors';
import axios from 'axios';

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

// 1秒ごとに統計をログ出力
setInterval(() => {
  for (const [roomNumber, stats] of playerGameStateStats.entries()) {
    if (stats.count > 0) {
      const connectionsInRoom = roomConnections.get(roomNumber)?.size || 0;
      console.log(`🔄 Player game state relays: ${stats.count}/sec from ${connectionsInRoom} clients in room ${roomNumber}`);
      stats.count = 0; // リセット
    }
  }
}, 1000);

// NPC Manager URL for proxy requests
const NPC_MANAGER_URL = process.env.NPC_MANAGER_URL || 'http://npc_manager:3003';

// FastifyとSocket.IOサーバーを作成
const fastify = Fastify({
  logger: {
    level: 'info'
  }
});

// CORS設定
fastify.register(cors, {
  origin: true,
  credentials: true
});

const server = createServer(fastify.server);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Socket.IO handlers - Pure data relay only
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join room - Only for routing purposes
  socket.on('join-room', (data) => {
    const { roomNumber, userId } = data;
    console.log(`Client ${socket.id} joining room ${roomNumber} as user ${userId}`);

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
            console.log(`🧹 Cleaned up room state for ${room}`);
          } else if (roomLeaders.get(room) === socket.id) {
            // If leaving player is leader, assign new leader
            const newLeader = Array.from(roomSet)[0];
            roomLeaders.set(room, newLeader);
            console.log(`New leader assigned in room ${room}: ${newLeader}`);
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
      console.log(`Room leader assigned: ${socket.id} for room ${roomNumber}`);
    }

    const currentPlayerCount = roomSet.size;
    const isRoomLeader = roomLeaders.get(roomNumber) === socket.id;

    console.log(`Room ${roomNumber} now has ${currentPlayerCount} connections, leader: ${roomLeaders.get(roomNumber)}`);

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
      console.log(`🎮 Sending existing game state to new participant ${socket.id} in room ${roomNumber}`);
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
      console.log(`Relaying countdown from ${socket.id} in room ${roomNumber}`);
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
      console.log(`Relaying game start from ${socket.id} in room ${roomNumber}`);

      // Record room game state for future participants
      roomGameStates.set(roomNumber, { gameStarted: true, timestamp: Date.now() });
      console.log(`🎮 Recorded game start state for room ${roomNumber}`);

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
    if (eventName !== 'ping' && eventName !== 'pong') {
      console.log(`🔍 SFU received event: ${eventName} from ${socket.id}`, args.length > 0 ? args[0] : '');
    }
  });

  // クライアント接続時のルーム参加確認
  socket.on('join-gamepong42-room', (data) => {
    const { roomNumber, playerInfo } = data;
    console.log(`👥 Client ${socket.id} joining room ${roomNumber} as ${playerInfo?.name || 'unknown'}`);

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
            roomLeaders.delete(room); // Remove leader when room is empty
            roomGameStates.delete(room); // Clean up game state
            console.log(`🧹 Cleaned up room state for ${room}`);
          } else if (roomLeaders.get(room) === socket.id) {
            // If leaving player is leader, assign new leader
            const newLeader = Array.from(roomSet)[0];
            roomLeaders.set(room, newLeader);
            console.log(`New leader assigned in room ${room}: ${newLeader}`);
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
      console.log(`Room leader assigned: ${socket.id} for room ${roomNumber}`);
    }

    const currentPlayerCount = roomSet.size;
    const isRoomLeader = roomLeaders.get(roomNumber) === socket.id;

    console.log(`Room ${roomNumber} now has ${currentPlayerCount} connections, leader: ${roomLeaders.get(roomNumber)}`);

    // Send join confirmation to the joining player with leader status
    socket.emit('room-join-confirmed', {
      roomNumber,
      isRoomLeader,
      participantCount: currentPlayerCount,
      timestamp: Date.now()
    });

    // Notify all OTHER clients in the room about the new player
    socket.to(roomNumber).emit('player-joined', {
      socketId: socket.id,
      userId: playerInfo?.name || 'unknown',
      participantCount: currentPlayerCount,
      timestamp: Date.now()
    });

    // 新規参加者に既存の参加者リストを送信
    const existingClients = Array.from(roomSet).filter(id => id !== socket.id);
    if (existingClients.length > 0) {
      console.log(`📤 Sending existing clients list to new participant ${socket.id}:`, existingClients);
      socket.emit('existing-players-list', {
        roomNumber,
        existingClients,
        timestamp: Date.now()
      });
    }

    // ルーム内のクライアント一覧を確認（デバッグ用）
    const clientsInRoom = io.sockets.adapter.rooms.get(roomNumber);
    console.log(`📋 Clients in room ${roomNumber}:`, Array.from(clientsInRoom || []));
  });

  socket.on('player-game-state', (data) => {
    console.log(`📨 SFU received player-game-state from ${socket.id} (${data?.playerGameState?.playerId || 'unknown'})`);
    console.log(`🔍 Full player-game-state data:`, JSON.stringify(data).substring(0, 200) + '...');
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    console.log(`🏠 Client ${socket.id} rooms:`, Array.from(socket.rooms));
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

      console.log(`📡 Relaying player game state from ${socket.id} in room ${roomNumber} to ${clientsInRoom - 1} other clients`);

      // デバッグログ（100回に1回で詳細ログ）
      const stats = playerGameStateStats.get(roomNumber)!;
      if (stats.count % 100 === 1) {
        console.log(`🔍 Player Game State Stats (room ${roomNumber}):`, {
          totalReceived: stats.count,
          playerId: data.playerGameState?.playerId,
          playerName: data.playerGameState?.playerName,
          hasGameState: !!data.playerGameState?.gameState,
          clientsInRoom: clientsInRoom,
          ballPos: data.playerGameState?.gameState?.ball ?
            { x: data.playerGameState.gameState.ball.x.toFixed(1), y: data.playerGameState.gameState.ball.y.toFixed(1) } : 'N/A'
        });
      }
    } else {
      console.log('⚠️ Player game state received but no room found for socket:', socket.id);
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
      console.log(`Relaying game over from ${socket.id} in room ${roomNumber}`);
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
      console.log(`Relaying GamePong42 data from ${socket.id} in room ${roomNumber}`);

      // Relay to all clients in the room (including sender for verification)
      io.to(roomNumber).emit('gamepong42-data', {
        ...data,
        from: socket.id,
        relayTimestamp: Date.now()
      });
    }
  });

  // NPC Manager specific room joining (different from regular players)
  socket.on('join-gamepong42-room', (data) => {
    const { roomNumber, playerInfo } = data;
    console.log(`NPC Manager joining GamePong42 room ${roomNumber} as ${playerInfo?.name || 'unknown'}`);

    socket.join(roomNumber);

    // Track NPC Manager connections separately if needed
    if (playerInfo?.isNPCManager) {
      console.log(`NPC Manager connected to room ${roomNumber}`);
    }

    // Confirm join to NPC Manager
    socket.emit('gamepong42-room-joined', {
      roomNumber,
      timestamp: Date.now()
    });
  });

  // NPC Request relay - クライアント→SFU→npc_manager
  socket.on('npc-request', async (data) => {
    const roomNumber = Array.from(socket.rooms).find(room => room !== socket.id);
    if (!roomNumber) {
      socket.emit('npc-response', { error: 'Not in a room' });
      return;
    }

    try {
      console.log(`Relaying NPC request from ${socket.id} in room ${roomNumber}:`, data);

      // npc_managerにHTTPリクエストを中継
      const npcResponse = await axios.post(`${NPC_MANAGER_URL}/api/npc/request-via-sfu`, {
        ...data,
        roomNumber,
        requesterId: socket.id,
        sfuServerUrl: `http://sfu:3001` // SFU自身のURL
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
      console.error(`Failed to relay NPC request from ${socket.id}:`, error);
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
    console.log(`Client disconnected: ${socket.id}`);

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
          console.log(`Room ${roomNumber} is empty, removed from tracking`);
        } else {
          // If the disconnected player was the leader, assign new leader
          if (wasLeader) {
            const newLeader = Array.from(connectionSet)[0];
            roomLeaders.set(roomNumber, newLeader);
            console.log(`New leader assigned in room ${roomNumber}: ${newLeader} (previous leader ${socket.id} disconnected)`);

            // Notify the new leader
            io.to(newLeader).emit('room-leader-assigned', {
              roomNumber,
              isRoomLeader: true,
              participantCount: connectionSet.size,
              timestamp: Date.now()
            });
          }

          console.log(`Room ${roomNumber} now has ${connectionSet.size} connections`);
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
    const PORT = parseInt(process.env.PORT || '3001');

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`SFU Data Relay Server running on port ${PORT}`);
      console.log(`Server principle: Pure data relay - no state management`);
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
