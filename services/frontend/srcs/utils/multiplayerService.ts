import { io, Socket } from 'socket.io-client';

export interface GameState {
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  players: {
    player1: {
      x: number;
      y: number;
    };
    player2: {
      x: number;
      y: number;
    };
  };
  score: {
    player1: number;
    player2: number;
  };
  gameStarted: boolean;
  gameOver: boolean;
  winner: number | null;
  timestamp: number;
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  timestamp: number;
}

export interface PlayerInfo {
  id: string;
  avatar: string;
  name?: string;
}

export interface RoomState {
  playerId: string;
  playerNumber: 1 | 2 | 'spectator';
  players: Array<{ playerId: string; playerInfo: PlayerInfo; playerNumber: 1 | 2 }>;
  spectators: Array<{ playerId: string; playerInfo: PlayerInfo; joinedAt: Date }>;
  isGameReady: boolean;
  isSpectator: boolean;
}

export class MultiplayerService {
  private socket: Socket | null = null;
  private roomNumber: string | null = null;
  private playerId: string | null = null;
  private playerNumber: 1 | 2 | 'spectator' | null = null;
  private isConnected = false;
  private isConnecting = false; // 接続中かどうかのフラグ
  private isJoiningRoom = false; // 部屋参加中かどうかのフラグ

  // イベントリスナー
  private eventListeners: { [key: string]: Function[] } = {};

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket() {
    // 環境に応じてSFUサーバーのURLを決定
    const getSFUServerUrl = () => {
      // 本番環境の場合
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // HTTPSの場合はhttpsを使用、HTTPの場合はhttpを使用
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const hostname = window.location.hostname;
        const port = '3001';
        return `${protocol}//${hostname}:${port}`;
      }
      // 開発環境の場合
      return 'http://localhost:3001';
    };

    const sfuUrl = getSFUServerUrl();
    console.log('Connecting to SFU server:', sfuUrl);

    // SFUサーバーに接続
    this.socket = io(sfuUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      // 自己署名証明書対応
      rejectUnauthorized: false,
      // 追加のSSL設定
      secure: true,
      forceNew: true,
      reconnection: true,
      timeout: 5000,
      // CORS設定
      withCredentials: true
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.playerId = this.socket!.id || null;
      console.log('Connected to SFU server:', this.playerId);
      this.emit('connected', { playerId: this.playerId });
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('Disconnected from SFU server');
      this.emit('disconnected');
    });

    this.socket.on('room-joined', (data: RoomState) => {
      this.playerNumber = data.playerNumber;
      console.log(`Joined room as player ${this.playerNumber}`);
      this.emit('roomJoined', data);
    });

    this.socket.on('player-joined', (data: any) => {
      console.log('Another participant joined:', data);
      this.emit('playerJoined', data);
    });

    this.socket.on('participant-joined', (data: any) => {
      console.log('Another participant joined:', data);
      this.emit('playerJoined', data);
    });

    this.socket.on('player-left', (data: { playerId: string }) => {
      console.log('Player left:', data);
      this.emit('playerLeft', data);
    });

    this.socket.on('game-ready', (data: any) => {
      console.log('Game is ready to start');
      this.emit('gameReady', data);
    });

    this.socket.on('game-started', (data: { roomNumber: string; players: any[]; initiator: string }) => {
      console.log('Game started:', data);
      this.emit('gameStarted', data);
    });

    this.socket.on('game-start-failed', (data: { reason: string; currentPlayers: number }) => {
      console.log('Game start failed:', data);
      this.emit('gameStartFailed', data);
    });

    this.socket.on('game-state-update', (data: { playerId: string; gameState: GameState }) => {
      this.emit('gameStateUpdate', data);
    });

    this.socket.on('player-input-update', (data: { playerId: string; playerNumber: 1 | 2 | 'spectator'; input: PlayerInput }) => {
      this.emit('playerInputUpdate', data);
    });

    // 完全なゲーム状態の同期
    this.socket.on('full-game-state-update', (data: { playerId: string; gameState: GameState }) => {
      this.emit('fullGameStateUpdate', data);
    });

    this.socket.on('score-updated', (data: { scorer: 'player1' | 'player2'; playerId: string }) => {
      this.emit('scoreUpdated', data);
    });

    this.socket.on('game-ended', (data: { winner: number; playerId: string }) => {
      this.emit('gameEnded', data);
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
      this.emit('error', error);
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      if (this.isConnected) {
        resolve();
        return;
      }

      // 既に接続中の場合は待機
      if (this.isConnecting) {
        const checkConnection = () => {
          if (this.isConnected) {
            resolve();
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.isConnecting = true;
      this.socket.connect();

      const onConnect = () => {
        this.isConnecting = false;
        this.socket!.off('connect', onConnect);
        this.socket!.off('connect_error', onError);
        resolve();
      };

      const onError = (error: any) => {
        this.isConnecting = false;
        this.socket!.off('connect', onConnect);
        this.socket!.off('connect_error', onError);
        reject(error);
      };

      this.socket.on('connect', onConnect);
      this.socket.on('connect_error', onError);
    });
  }

  disconnect() {
    if (this.socket && this.isConnected) {
      if (this.roomNumber) {
        this.leaveRoom();
      }
      this.socket.disconnect();
    }
  }

  async joinRoom(roomNumber: string, playerInfo: PlayerInfo): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to server');
    }

    // 既に同じ部屋に参加している場合は何もしない
    if (this.roomNumber === roomNumber) {
      console.log(`Already in room ${roomNumber}`);
      return;
    }

    // 別の部屋に参加している場合は先に離脱
    if (this.roomNumber) {
      this.leaveRoom();
    }

    // 部屋参加中フラグをチェック
    if (this.isJoiningRoom) {
      throw new Error('Already joining a room');
    }

    this.isJoiningRoom = true;
    this.roomNumber = roomNumber;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.isJoiningRoom = false;
        reject(new Error('Join room timeout'));
      }, 5000);

      const onRoomJoined = () => {
        this.isJoiningRoom = false;
        clearTimeout(timeout);
        this.off('roomJoined', onRoomJoined);
        this.off('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        this.isJoiningRoom = false;
        clearTimeout(timeout);
        this.off('roomJoined', onRoomJoined);
        this.off('error', onError);
        reject(error);
      };

      this.on('roomJoined', onRoomJoined);
      this.on('error', onError);

      this.socket!.emit('join-room', { roomNumber, playerInfo });
    });
  }

  leaveRoom() {
    if (this.socket && this.roomNumber) {
      this.socket.emit('leave-room', { roomNumber: this.roomNumber });
      this.roomNumber = null;
      this.playerNumber = null;
      this.isJoiningRoom = false; // フラグをリセット
    }
  }

  sendGameState(gameState: GameState) {
    if (this.socket && this.roomNumber) {
      this.socket.emit('game-state', {
        roomNumber: this.roomNumber,
        gameState: {
          ...gameState,
          timestamp: Date.now()
        }
      });
    }
  }

  sendPlayerInput(input: PlayerInput) {
    if (this.socket && this.roomNumber) {
      this.socket.emit('player-input', {
        roomNumber: this.roomNumber,
        input: {
          ...input,
          timestamp: Date.now()
        }
      });
    }
  }

  sendScoreUpdate(scorer: 'player1' | 'player2') {
    if (this.socket && this.roomNumber) {
      this.socket.emit('score-update', {
        roomNumber: this.roomNumber,
        scorer
      });
    }
  }

  sendGameEnd(winner: number) {
    if (this.socket && this.roomNumber) {
      this.socket.emit('game-end', {
        roomNumber: this.roomNumber,
        winner
      });
    }
  }

  // 新しいメソッド: ゲーム状態の完全同期
  sendFullGameState(gameState: GameState) {
    if (this.socket && this.roomNumber) {
      this.socket.emit('full-game-state', {
        roomNumber: this.roomNumber,
        gameState: {
          ...gameState,
          timestamp: Date.now()
        }
      });
    }
  }

  // ゲーム開始要求（ドアクリック時に呼び出し）
  startGame() {
    if (this.socket && this.roomNumber) {
      console.log(`Requesting to start game in room ${this.roomNumber}`);
      this.socket.emit('start-game', {
        roomNumber: this.roomNumber
      });
    } else {
      console.error('Cannot start game: not connected or not in a room');
    }
  }

  // イベントリスナー管理
  on(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data?: any) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ゲッター
  getPlayerNumber(): 1 | 2 | 'spectator' | null {
    return this.playerNumber;
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  isSpectator(): boolean {
    return this.playerNumber === 'spectator';
  }

  isPlayer(): boolean {
    return this.playerNumber === 1 || this.playerNumber === 2;
  }

  getRoomNumber(): string | null {
    return this.roomNumber;
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  isInRoom(): boolean {
    return this.roomNumber !== null;
  }

  // 通信対戦モードかどうかを判定
  isMultiplayerMode(): boolean {
    return this.isConnected && this.roomNumber !== null;
  }
}

// シングルトンインスタンス
export const multiplayerService = new MultiplayerService();
