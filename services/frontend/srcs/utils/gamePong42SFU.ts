import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GamePong42WebRTC } from './webrtc';

interface GamePong42State {
  connected: boolean;
  roomState: any;
  error: string | null;
}

interface PlayerInfo {
  name: string;
  avatar?: string;
}

const SFU_URL = 'http://localhost:3001';

// ゲーム状態の型定義
interface GamePong42GameState {
  mainGame: {
    ball: { x: number; y: number; vx: number; vy: number };
    player: { x: number; y: number; score: number };
    pidNPC: { x: number; y: number; score: number };
    gameStarted: boolean;
    gameOver: boolean;
    winner: 'player' | 'pidNPC' | null;
  };
  sideGames: Array<{
    id: number;
    ball: { x: number; y: number; vx: number; vy: number };
    player1: { x: number; y: number; score: number; type: 'npc' | 'player'; name?: string };
    player2: { x: number; y: number; score: number; type: 'npc' | 'player'; name?: string };
    gameStarted: boolean;
    gameOver: boolean;
    winner: 1 | 2 | null;
    active: boolean;
  }>;
  roomState: {
    participantCount: number;
    npcCount: number;
    survivors: number;
    gameStarted: boolean;
    gameOver: boolean;
    timestamp: number;
  };
}

interface GamePong42Update {
  type: 'gameState' | 'playerInput' | 'gameEvent';
  data: GamePong42GameState | any;
  timestamp: number;
}

export const useGamePong42SFU = () => {
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [npcStates, setNpcStates] = useState<any[]>([]);
  const [webrtcReady, setWebrtcReady] = useState(false);
  const [gameState, setGameState] = useState<GamePong42GameState | null>(null);
  const [lastGameUpdate, setLastGameUpdate] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);
  const webrtcRef = useRef<GamePong42WebRTC | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔗 Already connected to SFU server');
      return;
    }

    console.log('🔗 Starting SFU connection process...');
    console.log('Connecting to SFU server:', SFU_URL);

    try {
      socketRef.current = io(SFU_URL, {
        transports: ['polling', 'websocket'],
        upgrade: true,
        timeout: 20000,
        forceNew: true,
        autoConnect: true
      });

      const socket = socketRef.current;

      // 接続成功
      socket.on('connect', () => {
        console.log('✅ Connected to SFU server:', socket.id);
        console.log('🔍 Socket connected state after connect:', socket.connected);
        // 接続状態を確認してから状態を更新
        setTimeout(() => {
          if (socket.connected) {
            setConnected(true);
            setError('');
            console.log('🔍 Socket state verified and connected state updated');
          }
        }, 200);
      });

      // 接続確認メッセージ
      socket.on('connection-confirmed', (data) => {
        console.log('✅ SFU connection confirmed:', data);
        setConnected(true);
      });

      // 接続エラー
      socket.on('connect_error', (err) => {
        console.error('❌ SFU connection error:', err);
        setError(`Connection failed: ${err.message}`);
        setConnected(false);
      });

      // 切断
      socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from SFU server:', reason);
        setConnected(false);
        setRoomState(null);
        setWebrtcReady(false);

        // WebRTCクリーンアップ
        if (webrtcRef.current) {
          webrtcRef.current.disconnect();
          webrtcRef.current = null;
        }
      });

      // エラーハンドリング
      socket.on('error', (err) => {
        console.error('❌ SFU socket error:', err);
        setError(`Socket error: ${err.message || err}`);
      });

      // GamePong42関連のイベント
      socket.on('gamepong42-joined', async (data) => {
        console.log('🎮 Joined GamePong42 room:', data);
        setRoomState(data);

        // WebRTCを初期化
        try {
          console.log('🔧 Initializing WebRTC for GamePong42...');
          webrtcRef.current = new GamePong42WebRTC(socket);
          const success = await webrtcRef.current.initialize();

          if (success) {
            console.log('✅ WebRTC initialized successfully');
            setWebrtcReady(true);

            // ゲーム状態受信のコールバックを設定
            webrtcRef.current.onGameStateReceived((gameState) => {
              console.log('📊 Game state received via WebRTC:', gameState);
              setNpcStates(prev => {
                // NPCの状態を更新
                return gameState?.npcStates || prev;
              });
            });
          } else {
            console.error('❌ Failed to initialize WebRTC');
            setError('Failed to initialize WebRTC');
          }
        } catch (err: any) {
          console.error('❌ WebRTC initialization error:', err);
          setError(`WebRTC error: ${err.message}`);
        }
      });

      // ゲーム状態更新イベント（Socket.IO経由）
      socket.on('gamepong42-game-state-update', (update: GamePong42Update) => {
        try {
          if (update.type === 'gameState' && update.data) {
            setGameState(update.data as GamePong42GameState);
            setLastGameUpdate(update.timestamp);

            // デバッグログ（頻度を制限）
            if (Date.now() % 1000 < 17) { // 約1秒に1回程度
              console.log('🎮 Game state updated:', {
                mainGame: update.data.mainGame,
                activeSideGames: update.data.sideGames?.filter((g: any) => g.active).length || 0,
                survivors: update.data.roomState?.survivors
              });
            }
          }
        } catch (err) {
          console.error('❌ Error processing game state update:', err);
        }
      });

      // ゲーム開始イベント
      socket.on('gamepong42-game-started', (data) => {
        console.log('🎮 GamePong42 game started:', data);
        setRoomState(prev => ({ ...prev, gameStarted: true, ...data }));
      });

      socket.on('gamepong42-participant-joined', (data) => {
        console.log('👥 New participant joined:', data);
        setRoomState((prev: any) => ({
          ...prev,
          participantCount: data.participantCount
        }));
      });

      socket.on('gamepong42-game-started', (data) => {
        console.log('🚀 GamePong42 started:', data);
        setRoomState((prev: any) => ({
          ...prev,
          gameStarted: true,
          ...data
        }));
      });

      socket.on('gamepong42-state', (data) => {
        console.log('📊 Game state update received:', data);
        // NPCの状態更新を処理
        if (data.gameState) {
          setNpcStates(prev => {
            const newStates = [...prev];
            // データを適切に処理してnpcStatesに追加
            newStates.push(data);
            return newStates;
          });
        }
      });

      // デバッグ: 全てのイベントをログ
      socket.onAny((eventName, ...args) => {
        console.log(`📨 SFU Event received: ${eventName}`, args);
      });

      console.log('🔗 SFU connect function called successfully');
    } catch (err: any) {
      console.error('❌ Failed to create SFU connection:', err);
      setError(`Failed to create connection: ${err.message}`);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Disconnecting from SFU server...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      setRoomState(null);
      setError('');
    }
  }, []);

  const joinGamePong42Room = useCallback((roomNumber: string, playerInfo: PlayerInfo) => {
    // Socket.IOの実際の接続状態を確認
    if (!socketRef.current || !socketRef.current.connected) {
      console.error('❌ Cannot join room: Socket.IO not connected');
      console.log('🔍 Debug - socketRef.current exists:', !!socketRef.current);
      console.log('🔍 Debug - socketRef.current?.connected:', socketRef.current?.connected);
      console.log('🔍 Debug - connected state:', connected);

      // 少し待ってから再試行
      setTimeout(() => {
        if (socketRef.current?.connected) {
          console.log('🔄 Retrying room join after connection stabilized');
          socketRef.current.emit('join-gamepong42', {
            roomNumber,
            playerInfo
          });
        } else {
          setError('Socket.IO connection is not stable');
        }
      }, 500);
      return;
    }

    console.log('🎮 Joining GamePong42 room:', { roomNumber, playerInfo });
    socketRef.current.emit('join-gamepong42', {
      roomNumber,
      playerInfo
    });
  }, [connected]);

  const sendGameState = useCallback((roomId: string, gameState: any) => {
    if (!socketRef.current?.connected) {
      console.warn('⚠️ Cannot send game state: not connected to SFU server');
      return;
    }

    // WebRTCを使用してゲーム状態を送信
    if (webrtcRef.current && webrtcReady) {
      console.log('📤 Sending game state via WebRTC data channel');
      webrtcRef.current.sendGameState({ roomId, gameState });
    } else {
      // フォールバック: Socket.IOを使用
      console.log('📤 Sending game state via Socket.IO (fallback)');
      socketRef.current.emit('gamepong42-send-state', {
        roomNumber: roomId,
        gameState
      });
    }
  }, [webrtcReady]);

  // プレイヤー入力を送信
  const sendPlayerInput = useCallback((roomId: string, input: { up: boolean; down: boolean; attack?: number }) => {
    if (!socketRef.current?.connected) {
      console.warn('⚠️ Cannot send player input: not connected to SFU server');
      return;
    }

    console.log('🎮 Sending player input:', input);
    socketRef.current.emit('gamepong42-player-input', {
      roomId,
      input
    });
  }, []);

  // ゲーム状態をリクエスト
  const requestGameState = useCallback((roomId: string): Promise<GamePong42GameState | null> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        reject(new Error('Not connected to SFU server'));
        return;
      }

      socketRef.current.emit('gamepong42-get-state', { roomId }, (response: any) => {
        if (response.success) {
          resolve(response.gameState);
        } else {
          reject(new Error(response.error || 'Failed to get game state'));
        }
      });
    });
  }, []);

  // ページ読み込み時に自動接続
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // 接続状態の変化をログ
  useEffect(() => {
    console.log('🔗 SFU connected state changed:', connected);
    if (connected && socketRef.current) {
      // 接続が確立されたら自動的にGamePong42ルームに参加
      const defaultRoomNumber = 'default';
      const playerInfo: PlayerInfo = {
        name: `Player_${Math.random().toString(36).substr(2, 9)}`
      };

      console.log('🎮 Auto-joining GamePong42 room...');
      joinGamePong42Room(defaultRoomNumber, playerInfo);
    }
  }, [connected, joinGamePong42Room]);

  // ルーム状態の変化をログ
  useEffect(() => {
    console.log('🏠 SFU room state effect triggered, roomState:', roomState);
    if (!roomState) {
      console.log('❓ No room state available');
    }
  }, [roomState]);

  return {
    connected,
    roomState,
    error,
    npcStates,
    gameState,
    lastGameUpdate,
    socket: socketRef.current,
    webrtc: webrtcRef.current,
    webrtcReady,
    connect,
    disconnect,
    joinGamePong42Room,
    sendGameState,
    sendPlayerInput,
    requestGameState
  };
};

export default useGamePong42SFU;
