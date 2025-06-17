import { io, Socket } from 'socket.io-client';

// DTLS接続情報の型定義
export interface DTLSConnectionInfo {
  isConnected: boolean;
  dtlsState: string;
  iceState: string;
  localCertificate?: RTCCertificate;
  remoteCertificate?: ArrayBuffer;
  selectedCandidatePair?: any; // WebRTC統計の実際の型
  stats?: any;
}

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

  // WebRTC関連
  private device: any = null; // mediasoup Device
  private sendTransport: any = null;
  private recvTransport: any = null;
  private dataProducer: any = null;
  private dataConsumer: any = null;
  private routerRtpCapabilities: any = null;
  private dtlsMonitoringInterval: number | null = null;
  private webrtcDataChannelReady = false;
  private webrtcInitialized = false;
  private webrtcInitializing = false;

  // イベントリスナー
  private eventListeners: { [key: string]: Function[] } = {};

  constructor() {
    this.initializeSocket();
    this.loadMediasoupClient();
  }

  private async loadMediasoupClient() {
    console.log('[MEDIASOUP-LOAD] Loading mediasoup-client...');
    try {
      // 動的にmediasoup-clientを読み込み
      const mediasoupClient = await import('mediasoup-client');
      console.log('[MEDIASOUP-LOAD] ✅ Mediasoup client module loaded');

      this.device = new mediasoupClient.Device();
      console.log('[MEDIASOUP-LOAD] ✅ Mediasoup device created successfully');
      console.log('[MEDIASOUP-LOAD] Device handler name:', this.device.handlerName);
      console.log('[MEDIASOUP-LOAD] Device loaded:', this.device.loaded);
    } catch (error) {
      console.error('[MEDIASOUP-LOAD] ❌ Failed to load mediasoup client:', error);
      // フォールバックとしてSocket.IOのみを使用
      console.log('[MEDIASOUP-LOAD] Falling back to Socket.IO only mode');
    }
  }

  private initializeSocket() {
    // SFUサーバーのURLを決定（HTTPS/WSS強制）
    const getSFUServerUrl = () => {
      const hostname = window.location.hostname;
      // WebRTCにはHTTPS/WSSが必要なので、必ずhttpsを使用
      const sfuUrl = `https://${hostname}:3042`;
      console.log('[SFU-URL] Forcing HTTPS/WSS connection to:', sfuUrl);
      return sfuUrl;
    };

    const sfuUrl = getSFUServerUrl();
    console.log('[SFU-CONNECT] Connecting to SFU server:', sfuUrl);

    // SFUサーバーにHTTPS/WSS接続
    this.socket = io(sfuUrl, {
      transports: ['websocket'], // WebSocketのみ使用（pollingを無効化）
      autoConnect: false,
      // HTTPS/WSS設定
      secure: true, // HTTPS/WSS強制
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10, // 再接続試行回数を増加
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000, // タイムアウトを延長
      // WebRTC用の設定
      upgrade: true,
      rememberUpgrade: false,
      // CORS設定
      withCredentials: true,
      // 追加のSSL設定（自己署名証明書対応）
      rejectUnauthorized: false
    });

    this.socket.on('connect', async () => {
      this.isConnected = true;
      this.playerId = this.socket!.id || null;
      console.log('🟢 [SFU-SUCCESS] Connected to SFU server:', this.playerId);
      console.log('🟢 [SFU-SUCCESS] SFU URL:', sfuUrl);

      // WebRTC/mediasoupの初期化を開始
      await this.initializeWebRTC();

      this.emit('connected', { playerId: this.playerId });
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('🔴 [SFU-ERROR] Failed to connect to SFU server:', error);
      console.error('🔴 [SFU-ERROR] Attempted URL:', sfuUrl);
      console.error('🔴 [SFU-ERROR] Error details:', error.message, error.type || 'unknown');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('🟡 [SFU-DISCONNECT] Disconnected from SFU server:', reason);
      this.emit('disconnected', { reason });
    });

    // サーバーからルーターRTPCapabilitiesを受信
    this.socket.on('connection-confirmed', async (data: { routerRtpCapabilities?: any }) => {
      console.log('Connection confirmed from server:', data);

      if (data.routerRtpCapabilities) {
        this.routerRtpCapabilities = data.routerRtpCapabilities;
        console.log('Router RTP capabilities received, initializing WebRTC...');

        // WebRTC/DTLSを初期化
        const webRtcInitialized = await this.initializeWebRTC();
        if (webRtcInitialized) {
          console.log('True SFU (WebRTC/DTLS) connection established');
        } else {
          console.log('Fallback to Socket.IO for data transfer');
        }
      }
    });

    // ルーターcapabilitiesの受信
    this.socket.on('router-capabilities', async (capabilities: any) => {
      console.log('[SOCKET] Router capabilities received:', !!capabilities);
      this.routerRtpCapabilities = capabilities;

      // 自動的にWebRTC初期化を試行
      if (capabilities && this.device) {
        console.log('[SOCKET] Auto-initializing WebRTC with received capabilities...');
        const initialized = await this.initializeWebRTC();
        if (initialized) {
          console.log('[SOCKET] ✅ WebRTC initialized from router-capabilities event');
        }
      }
    });

    this.setupSocketEvents();
  }

  private setupSocketEvents() {
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

    // トーナメント関連のイベントリスナー
    this.socket.on('tournament-created', (data: any) => {
      console.log('Tournament created event received:', data);
      this.emit('tournament-created', data);
    });

    this.socket.on('tournament-joined', (data: any) => {
      console.log('Tournament joined event received:', data);
      this.emit('tournament-joined', data);
    });

    this.socket.on('tournament-participant-joined', (data: any) => {
      this.emit('tournament-participant-joined', data);
    });

    this.socket.on('tournament-started', (data: any) => {
      this.emit('tournament-started', data);
    });

    this.socket.on('tournament-match-completed', (data: any) => {
      this.emit('tournament-match-completed', data);
    });

    this.socket.on('tournament-round-advanced', (data: any) => {
      this.emit('tournament-round-advanced', data);
    });

    this.socket.on('tournament-completed', (data: any) => {
      this.emit('tournament-completed', data);
    });

    this.socket.on('tournament-participant-left', (data: any) => {
      this.emit('tournament-participant-left', data);
    });

    this.socket.on('tournament-start-failed', (data: any) => {
      console.error('Tournament start failed:', data);
      this.emit('error', data);
    });

    this.socket.on('current-match', (data: any) => {
      this.emit('current-match', data);
    });

    this.socket.on('tournament-info', (data: any) => {
      this.emit('tournament-info', data);
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
    if (!this.roomNumber) return;

    const data = {
      type: 'game-state',
      roomNumber: this.roomNumber,
      gameState: {
        ...gameState,
        timestamp: Date.now()
      }
    };

    // WebRTCデータチャネルを優先して使用
    if (!this.sendGameDataViaWebRTC(data)) {
      // WebRTCが使用できない場合はSocket.IOにフォールバック
      console.log('⚠️ [FALLBACK] Using Socket.IO for game state (WebRTC not available)');
      if (this.socket) {
        this.socket.emit('game-state', data);
      }
    }
  }

  sendPlayerInput(input: PlayerInput) {
    if (!this.roomNumber) return;

    const data = {
      type: 'player-input',
      roomNumber: this.roomNumber,
      input: {
        ...input,
        timestamp: Date.now()
      }
    };

    // WebRTCデータチャネルを優先して使用
    if (!this.sendGameDataViaWebRTC(data)) {
      // WebRTCが使用できない場合はSocket.IOにフォールバック
      console.log('⚠️ [FALLBACK] Using Socket.IO for player input (WebRTC not available)');
      if (this.socket) {
        this.socket.emit('player-input', data);
      }
    }
  }

  sendScoreUpdate(scorer: 'player1' | 'player2') {
    if (!this.roomNumber) return;

    const data = {
      type: 'score-update',
      roomNumber: this.roomNumber,
      scorer
    };

    // スコア更新は重要なのでSocket.IOで確実に送信
    if (this.socket) {
      this.socket.emit('score-update', data);
    }
  }

  sendGameEnd(winner: number) {
    if (!this.roomNumber) return;

    const data = {
      type: 'game-end',
      roomNumber: this.roomNumber,
      winner
    };

    // ゲーム終了は重要なのでSocket.IOで確実に送信
    if (this.socket) {
      this.socket.emit('game-end', data);
    }
  }

  // 新しいメソッド: ゲーム状態の完全同期
  sendFullGameState(gameState: GameState) {
    if (!this.roomNumber) return;

    const data = {
      type: 'full-game-state',
      roomNumber: this.roomNumber,
      gameState: {
        ...gameState,
        timestamp: Date.now()
      }
    };

    // WebRTCデータチャネルを優先して使用
    if (!this.sendGameDataViaWebRTC(data)) {
      // WebRTCが使用できない場合はSocket.IOにフォールバック
      console.log('⚠️ [FALLBACK] Using Socket.IO for full game state (WebRTC not available)');
      if (this.socket) {
        this.socket.emit('full-game-state', data);
      }
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

  // ===== WebRTC/DTLS関連メソッド =====

  private async initializeWebRTC() {
    console.log('[WebRTC-INIT] Starting WebRTC initialization...');
    console.log('[WebRTC-INIT] Device:', !!this.device);
    console.log('[WebRTC-INIT] Router RTP Capabilities:', !!this.routerRtpCapabilities);

    // 重複初期化を防ぐ
    if (this.webrtcInitialized) {
      console.log('[WebRTC-INIT] ⚠️ WebRTC already initialized, skipping');
      return true;
    }

    if (this.webrtcInitializing) {
      console.log('[WebRTC-INIT] ⚠️ WebRTC initialization already in progress, skipping');
      return false;
    }

    this.webrtcInitializing = true;

    if (!this.device) {
      console.error('[WebRTC-INIT] Mediasoup device not available');
      this.webrtcInitializing = false;
      return false;
    }

    // RTPケイパビリティがまだない場合はSFUから取得
    if (!this.routerRtpCapabilities) {
      try {
        console.log('[WebRTC-INIT] Fetching RTP capabilities from SFU...');
        const sfuUrl = `https://${window.location.hostname}:3042`;
        const response = await fetch(`${sfuUrl}/api/router-rtp-capabilities`);

        if (!response.ok) {
          throw new Error(`Failed to fetch RTP capabilities: ${response.status}`);
        }

        const data = await response.json();
        this.routerRtpCapabilities = data.rtpCapabilities;

        console.log('[WebRTC-INIT] ✅ Got RTP capabilities from SFU');
      } catch (error) {
        console.error('[WebRTC-INIT] ❌ Failed to fetch RTP capabilities:', error);
        return false;
      }
    }

    try {
      console.log('[WebRTC-INIT] Loading device with RTP capabilities...');

      // 重複読み込みを防ぐ
      if (!this.device.loaded) {
        // SCTPサポートを含むルーターキャパビリティでデバイスをロード
        const routerCapabilities = {
          ...this.routerRtpCapabilities,
          sctpCapabilities: {
            numStreams: { OS: 1024, MIS: 1024 }
          }
        };

        await this.device.load({ routerRtpCapabilities: routerCapabilities });
        console.log('[WebRTC-INIT] ✅ Device loaded with RTP capabilities and SCTP support');
        console.log('[WebRTC-INIT] SCTP capabilities:', this.device.sctpCapabilities);
      } else {
        console.log('[WebRTC-INIT] ⚠️ Device already loaded, skipping load step');
      }

      console.log('[WebRTC-INIT] Creating send transport...');
      await this.createSendTransport();
      console.log('[WebRTC-INIT] ✅ Send transport created');

      console.log('[WebRTC-INIT] Creating receive transport...');
      await this.createRecvTransport();
      console.log('[WebRTC-INIT] ✅ Receive transport created');

      console.log('[WebRTC-INIT] Creating data producer...');
      await this.createDataProducer();
      console.log('[WebRTC-INIT] ✅ Data producer created');

      console.log('[WebRTC-INIT] 🎉 WebRTC/DTLS connection established successfully');
      this.webrtcInitialized = true;
      this.webrtcInitializing = false;
      return true;
    } catch (error) {
      console.error('[WebRTC-INIT] ❌ Failed to initialize WebRTC:', error);
      this.webrtcInitializing = false;
      return false;
    }
  }

  private async createSendTransport() {
    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('createWebRtcTransport');

      this.socket!.once('webRtcTransportCreated', async (data: { params: any }) => {
        try {
          this.sendTransport = this.device.createSendTransport(data.params);

          this.sendTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
            try {
              this.socket!.emit('connectWebRtcTransport', { dtlsParameters });
              this.socket!.once('webRtcTransportConnected', () => callback());
            } catch (error) {
              errback(error);
            }
          });

          this.sendTransport.on('producedata', async ({ sctpStreamParameters, label, protocol, appData }: any, callback: any, errback: any) => {
            try {
              this.socket!.emit('createDataProducer', { sctpStreamParameters, label, protocol, appData });
              this.socket!.once('dataProducerCreated', ({ id }: any) => callback({ id }));
            } catch (error) {
              errback(error);
            }
          });

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async createRecvTransport() {
    return new Promise<void>((resolve, reject) => {
      this.socket!.emit('createWebRtcTransport');

      this.socket!.once('webRtcTransportCreated', async (data: { params: any }) => {
        try {
          this.recvTransport = this.device.createRecvTransport(data.params);

          this.recvTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
            try {
              this.socket!.emit('connectWebRtcTransport', { dtlsParameters });
              this.socket!.once('webRtcTransportConnected', () => callback());
            } catch (error) {
              errback(error);
            }
          });

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async createDataProducer() {
    if (!this.sendTransport) {
      throw new Error('Send transport not available');
    }

    // 既にデータプロデューサーが存在する場合はスキップ
    if (this.dataProducer) {
      console.log('[DATA-PRODUCER] ⚠️ Data producer already exists, skipping creation');
      return;
    }

    try {
      console.log('[DATA-PRODUCER] Creating data producer...');

      // SCTPパラメータを準備
      const sctpStreamParameters = {
        streamId: 0,
        ordered: false,
        maxRetransmits: 0
      };

      console.log('[DATA-PRODUCER] SCTP parameters:', sctpStreamParameters);

      // サーバーにデータプロデューサー作成を要求
      const result = await new Promise<{ id: string; sctpStreamParameters: any }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for data producer creation'));
        }, 10000);

        this.socket?.emit('createDataProducer', {
          sctpStreamParameters,
          label: 'gameData',
          protocol: 'gameProtocol',
          appData: { type: 'gameData' }
        });

        this.socket?.once('dataProducerCreated', (data: { id: string; sctpStreamParameters: any }) => {
          clearTimeout(timeout);
          resolve(data);
        });

        this.socket?.once('dataProducerCreationFailed', (error: any) => {
          clearTimeout(timeout);
          reject(new Error(error.message || 'Data producer creation failed'));
        });
      });

      console.log('[DATA-PRODUCER] Server acknowledged data producer creation:', result);

      // クライアント側でデータプロデューサーを作成
      this.dataProducer = await this.sendTransport.produceData({
        id: result.id,
        sctpStreamParameters: result.sctpStreamParameters,
        label: 'gameData',
        protocol: 'gameProtocol',
        appData: { type: 'gameData' }
      });

      this.dataProducer.on('open', () => {
        console.log('[DATA-PRODUCER] ✅ Data producer opened - WebRTC data channel ready');
        this.webrtcDataChannelReady = true;
      });

      this.dataProducer.on('error', (error: any) => {
        console.error('[DATA-PRODUCER] ❌ Data producer error:', error);
        this.webrtcDataChannelReady = false;
      });

      this.dataProducer.on('close', () => {
        console.log('[DATA-PRODUCER] Data producer closed');
        this.webrtcDataChannelReady = false;
      });

      console.log('[DATA-PRODUCER] ✅ Data producer created successfully, ID:', this.dataProducer.id);

    } catch (error) {
      console.error('[DATA-PRODUCER] ❌ Failed to create data producer:', error);
      this.webrtcDataChannelReady = false;
      throw error;
    }
  }

  // WebRTCデータチャネルでゲームデータを送信
  private sendGameDataViaWebRTC(data: any) {
    if (this.dataProducer && this.dataProducer.readyState === 'open') {
      try {
        const message = JSON.stringify(data);
        this.dataProducer.send(message);
        console.log('🚀 [WebRTC-DATA] Successfully sent data via WebRTC data channel:', data.type || 'unknown');
        return true;
      } catch (error) {
        console.error('❌ [WebRTC-DATA] Failed to send data via WebRTC:', error);
        return false;
      }
    }
    console.log('⚠️ [WebRTC-DATA] Data producer not ready, readyState:', this.dataProducer?.readyState || 'undefined');
    return false;
  }

  // 手動でWebRTC初期化をトリガーするメソッド
  async triggerWebRTCInitialization(): Promise<boolean> {
    console.log('[MANUAL-INIT] Manual WebRTC initialization triggered');

    if (!this.isConnected) {
      console.error('[MANUAL-INIT] Not connected to server');
      return false;
    }

    if (!this.routerRtpCapabilities) {
      console.log('[MANUAL-INIT] Requesting router capabilities from server...');
      this.socket?.emit('get-router-capabilities');

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!this.routerRtpCapabilities) {
        console.error('[MANUAL-INIT] Still no router capabilities available');
        return false;
      }
    }

    return await this.initializeWebRTC();
  }

  // DTLS接続の検証メソッド
  async verifyDTLSConnection(): Promise<DTLSConnectionInfo> {
    const result: DTLSConnectionInfo = {
      isConnected: false,
      dtlsState: 'unknown',
      iceState: 'unknown',
      localCertificate: undefined,
      remoteCertificate: undefined,
      selectedCandidatePair: undefined,
      stats: undefined
    };

    try {
      if (!this.sendTransport) {
        console.log('[DTLS-VERIFY] No send transport available');
        return result;
      }

      // MediasoupのWebRTCトランスポート統計を取得
      const transportStats = await this.sendTransport.getStats();
      result.stats = transportStats;

      // RTCPeerConnectionへのアクセス（内部API）
      const pc = (this.sendTransport as any)._handler?._pc;
      if (pc) {
        console.log('[DTLS-VERIFY] Found RTCPeerConnection');

        result.dtlsState = pc.connectionState || 'unknown';
        result.iceState = pc.iceConnectionState || 'unknown';

        result.isConnected = pc.connectionState === 'connected' &&
                           pc.iceConnectionState === 'connected';

        try {
          const stats = await pc.getStats();
          for (const [id, stat] of stats) {
            if (stat.type === 'certificate' && (stat as any).fingerprint) {
              if ((stat as any).fingerprintAlgorithm) {
                console.log(`[DTLS-VERIFY] Certificate found: ${(stat as any).fingerprintAlgorithm} ${(stat as any).fingerprint}`);
              }
            }

            if (stat.type === 'candidate-pair' && (stat as any).state === 'succeeded') {
              result.selectedCandidatePair = stat;
              console.log(`[DTLS-VERIFY] Selected candidate pair: ${(stat as any).localCandidateId || 'unknown'} -> ${(stat as any).remoteCandidateId || 'unknown'}`);
            }
          }
        } catch (error) {
          console.error('[DTLS-VERIFY] Failed to get WebRTC stats:', error);
        }

        console.log(`[DTLS-VERIFY] Connection State: ${pc.connectionState}`);
        console.log(`[DTLS-VERIFY] ICE State: ${pc.iceConnectionState}`);
        console.log(`[DTLS-VERIFY] Signaling State: ${pc.signalingState}`);
        console.log(`[DTLS-VERIFY] DTLS Connected: ${result.isConnected ? '✅' : '❌'}`);
      } else {
        console.log('[DTLS-VERIFY] No RTCPeerConnection found in transport');
      }

    } catch (error) {
      console.error('[DTLS-VERIFY] Error verifying DTLS connection:', error);
    }

    return result;
  }

  // 定期的にDTLS接続状態をチェックする
  startDTLSMonitoring(intervalMs: number = 5000) {
    if (this.dtlsMonitoringInterval) {
      clearInterval(this.dtlsMonitoringInterval);
    }

    this.dtlsMonitoringInterval = setInterval(async () => {
      const verification = await this.verifyDTLSConnection();

      if (verification.isConnected) {
        console.log('[DTLS-MONITOR] ✅ DTLS connection is healthy');
      } else {
        console.warn('[DTLS-MONITOR] ⚠️ DTLS connection issue detected:', {
          dtlsState: verification.dtlsState,
          iceState: verification.iceState
        });
      }
    }, intervalMs);
  }

  stopDTLSMonitoring() {
    if (this.dtlsMonitoringInterval) {
      clearInterval(this.dtlsMonitoringInterval);
      this.dtlsMonitoringInterval = null;
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

  // トーナメント関連メソッド
  createTournament(maxPlayers: number, playerInfo: PlayerInfo) {
    console.log('createTournament called with:', { maxPlayers, playerInfo });
    console.log('Socket status:', {
      hasSocket: !!this.socket,
      isConnected: this.isConnected,
      socketConnected: this.socket?.connected
    });

    if (this.socket && this.isConnected) {
      console.log('Emitting create-tournament event');
      this.socket.emit('create-tournament', {
        maxPlayers,
        playerInfo
      });
    } else {
      console.error('Cannot create tournament: not connected');
      this.emit('error', { message: 'Not connected to server' });
    }
  }

  joinTournament(tournamentId: string, playerInfo: PlayerInfo) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-tournament', {
        tournamentId,
        playerInfo
      });
    }
  }

  startTournament(tournamentId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('start-tournament', {
        tournamentId
      });
    }
  }

  reportTournamentResult(tournamentId: string, matchId: string, winnerId: string) {
    console.log('reportTournamentResult called:', { tournamentId, matchId, winnerId });
    console.log('Socket connected:', this.isConnected);

    if (this.socket && this.isConnected) {
      console.log('Emitting tournament-match-result to server');
      this.socket.emit('tournament-match-result', {
        tournamentId,
        matchId,
        winnerId
      });
    } else {
      console.error('Cannot report tournament result: socket not connected');
    }
  }

  leaveTournament(tournamentId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-tournament', {
        tournamentId
      });
    }
  }

  getCurrentMatch(tournamentId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('get-current-match', {
        tournamentId
      });
    }
  }

  getTournamentInfo(tournamentId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('get-tournament', {
        tournamentId
      });
    }
  }
}

// シングルトンインスタンス
export const multiplayerService = new MultiplayerService();
