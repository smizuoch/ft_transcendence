import fastify from 'fastify';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MediasoupService } from './mediasoup-service';
import { RoomManager } from './room-manager';
import { GameState } from './types';

const app = fastify({ logger: true });

// CORSの設定 - 動的にoriginを許可
const allowedOrigins = [
  'http://localhost:8080',
  'https://localhost:8443',
  'http://10.16.2.9:8080',
  'https://10.16.2.9:8443'
];

// Fastify CORS設定
app.register(require('@fastify/cors'), {
  origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
    // originがundefined（同一オリジン）または許可リストに含まれている場合は許可
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // ローカルIPアドレスのパターンもチェック
      const localIpPattern = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.)/;
      if (localIpPattern.test(origin)) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
});

// Socket.IOサーバーの設定
const io = new SocketIOServer({
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        const localIpPattern = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.)/;
        if (localIpPattern.test(origin)) {
          callback(null, true);
        } else {
          console.log('Socket.IO CORS blocked origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// MediasoupとRoomManagerのインスタンス
const mediasoupService = new MediasoupService();
const roomManager = new RoomManager();

async function startServer() {
  try {
    // Mediasoupワーカーを初期化
    await mediasoupService.initialize();
    console.log('Mediasoup service initialized');
    console.log('Starting Socket.IO event handlers...');

    // Socket.IOイベントハンドラー
    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      console.log(`Total connected clients: ${io.sockets.sockets.size}`);

      // 接続時にクライアントに確認メッセージを送信
      socket.emit('connection-confirmed', {
        message: 'Successfully connected to SFU server',
        serverId: socket.id
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

      // 部屋への参加
      socket.on('join-room', async (data: { roomNumber: string; playerInfo: any }) => {
        try {
          const { roomNumber, playerInfo } = data;
          console.log(`Player ${socket.id} attempting to join room ${roomNumber}`);

          // 既に同じ部屋にいるかチェック
          const existingRooms = Array.from(socket.rooms);
          if (existingRooms.includes(roomNumber)) {
            console.log(`Player ${socket.id} already in room ${roomNumber}`);
            const room = roomManager.getRoom(roomNumber);
            if (room) {
              socket.emit('room-joined', {
                playerId: socket.id,
                playerNumber: room.getPlayerNumber(socket.id),
                players: room.getPlayers(),
                isGameReady: room.getPlayerCount() === 2
              });
            }
            return;
          }

          // 部屋に参加
          const room = roomManager.joinRoom(roomNumber, socket.id, playerInfo);
          socket.join(roomNumber);

          console.log(`Player ${socket.id} successfully joined room ${roomNumber} as player ${room.getPlayerNumber(socket.id)}`);

          // プレイヤー情報を送信
          socket.emit('room-joined', {
            playerId: socket.id,
            playerNumber: room.getPlayerNumber(socket.id),
            players: room.getPlayers(),
            isGameReady: room.getPlayerCount() === 2
          });

          // 他のプレイヤーに新しいプレイヤーの参加を通知
          socket.to(roomNumber).emit('player-joined', {
            playerId: socket.id,
            playerInfo,
            playerNumber: room.getPlayerNumber(socket.id),
            isGameReady: room.getPlayerCount() === 2
          });

          // 2人揃ったらゲーム開始準備
          if (room.getPlayerCount() === 2) {
            io.to(roomNumber).emit('game-ready', {
              players: room.getPlayers()
            });
          }

        } catch (error) {
          console.error('Error joining room:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // ゲーム状態の同期
      socket.on('game-state', (data: { roomNumber: string; gameState: GameState }) => {
        const { roomNumber, gameState } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          // 他のプレイヤーにゲーム状態を送信（送信者以外）
          socket.to(roomNumber).emit('game-state-update', {
            playerId: socket.id,
            gameState
          });
        }
      });

      // プレイヤーの入力状態
      socket.on('player-input', (data: { roomNumber: string; input: any }) => {
        const { roomNumber, input } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          // 他のプレイヤーに入力状態を送信
          socket.to(roomNumber).emit('player-input-update', {
            playerId: socket.id,
            playerNumber: room.getPlayerNumber(socket.id),
            input
          });
        }
      });

      // スコア更新
      socket.on('score-update', (data: { roomNumber: string; scorer: 'player1' | 'player2' }) => {
        const { roomNumber, scorer } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          // 全プレイヤーにスコア更新を送信
          io.to(roomNumber).emit('score-updated', {
            scorer,
            playerId: socket.id
          });
        }
      });

      // ゲーム開始要求（ドアクリック）
      socket.on('start-game', (data: { roomNumber: string }) => {
        const { roomNumber } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          console.log(`Player ${socket.id} requested to start game in room ${roomNumber}`);

          // 部屋に2人いる場合のみゲーム開始
          if (room.getPlayerCount() === 2) {
            console.log(`Starting game in room ${roomNumber}`);
            // 全プレイヤーにゲーム開始を送信
            io.to(roomNumber).emit('game-started', {
              roomNumber,
              players: room.getPlayers(),
              initiator: socket.id
            });
          } else {
            // プレイヤーが不足している場合
            socket.emit('game-start-failed', {
              reason: 'Need 2 players to start the game',
              currentPlayers: room.getPlayerCount()
            });
          }
        }
      });

      // ゲーム終了
      socket.on('game-end', (data: { roomNumber: string; winner: number }) => {
        const { roomNumber, winner } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          // 全プレイヤーにゲーム終了を送信
          io.to(roomNumber).emit('game-ended', {
            winner,
            playerId: socket.id
          });
        }
      });

      // 切断処理
      socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
        console.log(`Total connected clients: ${io.sockets.sockets.size}`);

        // プレイヤーを全ての部屋から削除
        const roomNumber = roomManager.removePlayer(socket.id);
        if (roomNumber) {
          console.log(`Player ${socket.id} left room ${roomNumber}`);
          socket.to(roomNumber).emit('player-left', {
            playerId: socket.id
          });
        }
      });

      // 部屋から退出
      socket.on('leave-room', (data: { roomNumber: string }) => {
        const { roomNumber } = data;
        const room = roomManager.getRoom(roomNumber);

        if (room && room.hasPlayer(socket.id)) {
          room.removePlayer(socket.id);
          socket.leave(roomNumber);

          socket.to(roomNumber).emit('player-left', {
            playerId: socket.id
          });

          // 部屋が空になったら削除
          if (room.getPlayerCount() === 0) {
            roomManager.removeRoom(roomNumber);
          }
        }
      });
    });

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
        activePlayers: roomManager.getTotalPlayers()
      };
    });

    const PORT = process.env.PORT || 3001;

    // Fastifyサーバーを起動
    await app.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`SFU Server running on port ${PORT}`);

    // Socket.IOをFastifyサーバーに接続
    io.attach(app.server);

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
