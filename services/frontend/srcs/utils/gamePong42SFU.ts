import { useCallback, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface GamePong42State {
  connected: boolean;
  error: string | null;
}

interface PlayerInfo {
  name: string;
  avatar?: string;
}

const SFU_URL = 'http://localhost:3001';

// クライアント側で管理するゲーム状態の型定義
interface GamePong42LocalState {
  participantCount: number;
  countdown: number;
  gameStarted: boolean;
  gameOver: boolean;
  playerInfos: Map<string, PlayerInfo>;
  isRoomLeader: boolean;
  roomLeaderId: string | null;
}

// WebRTC経由で中継するデータの型定義
interface GamePong42Data {
  type: 'playerInput' | 'gameState' | 'gameEvent' | 'ping' | 'sharedState' | 'roomLeader';
  playerId: string;
  timestamp: number;
  payload: any;
}

// 共通データの型定義（Room Leaderが管理）
interface SharedGameState {
  countdown: number;
  gameStarted: boolean;
  gameOver: boolean;
  participantCount: number;
}

export const useGamePong42SFU = () => {
  const [state, setState] = useState<GamePong42State>({
    connected: false,
    error: null,
  });

  const [localGameState, setLocalGameState] = useState<GamePong42LocalState>({
    participantCount: 1,
    countdown: 30,
    gameStarted: false,
    gameOver: false,
    playerInfos: new Map(),
    isRoomLeader: false,
    roomLeaderId: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const roomNumberRef = useRef<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const [receivedData, setReceivedData] = useState<GamePong42Data[]>([]);

  // 接続状態を監視
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('🔗 SFU already connected');
      return;
    }

    console.log('🔗 Connecting to SFU server:', SFU_URL);

    const socket = io(SFU_URL, {
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to SFU server:', socket.id);
      playerIdRef.current = socket.id;
      setState(prev => ({ ...prev, connected: true, error: null }));
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from SFU server:', reason);
      setState(prev => ({ ...prev, connected: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('❌ SFU connection error:', error);
      setState(prev => ({ ...prev, error: `Connection failed: ${error.message}` }));
    });

    // WebRTCデータ中継イベント
    socket.on('gamepong42-data', (data: { senderId: string; payload: GamePong42Data }) => {
      console.log('📨 Received relayed data:', data);
      setReceivedData(prev => [...prev, data.payload]);

      // Room Leaderからの共通データを受信した場合
      if (data.payload.type === 'sharedState' && !localGameState.isRoomLeader) {
        const sharedState = data.payload.payload as SharedGameState;
        console.log('🎯 Received shared state from Room Leader:', sharedState);

        setLocalGameState(prev => ({
          ...prev,
          countdown: sharedState.countdown,
          gameStarted: sharedState.gameStarted,
          gameOver: sharedState.gameOver,
          participantCount: sharedState.participantCount,
        }));
      }

      // Room Leader指定メッセージの場合
      if (data.payload.type === 'roomLeader') {
        const { leaderId } = data.payload.payload;
        console.log('👑 Room Leader assigned:', leaderId);

        setLocalGameState(prev => ({
          ...prev,
          isRoomLeader: leaderId === playerIdRef.current,
          roomLeaderId: leaderId,
        }));

        // 自分がRoom Leaderになった場合、カウントダウンを開始
        if (leaderId === playerIdRef.current) {
          console.log('👑 I am now the Room Leader, starting countdown...');
          startCountdown();
        }
      }
    });

    // 部屋参加確認イベント
    socket.on('gamepong42-room-joined', (data: { roomNumber: string; message: string; participantCount: number; isFirstPlayer: boolean }) => {
      console.log('✅ Room joined for data relay:', data);
      roomNumberRef.current = data.roomNumber;

      setLocalGameState(prev => ({
        ...prev,
        participantCount: data.participantCount,
        isRoomLeader: data.isFirstPlayer,
        roomLeaderId: data.isFirstPlayer ? playerIdRef.current : null,
      }));

      // 最初のプレイヤー（Room Leader）の場合のみカウントダウンを開始
      if (data.isFirstPlayer) {
        console.log('👑 I am the Room Leader, starting countdown...');
        startCountdown();
      } else {
        console.log('🎮 Waiting for shared state from Room Leader...');
      }
    });

    socket.on('gamepong42-participant-joined', (data: { playerId: string; participantCount: number }) => {
      console.log('🎮 New participant joined:', data);
      setLocalGameState(prev => ({
        ...prev,
        participantCount: data.participantCount
      }));
    });

    socket.on('gamepong42-participant-left', (data: { playerId: string; participantCount: number }) => {
      console.log('👋 Participant left:', data);
      setLocalGameState(prev => ({
        ...prev,
        participantCount: data.participantCount
      }));
    });

    socket.on('gamepong42-room-error', (data: { error: string }) => {
      console.error('❌ Room error:', data);
      setState(prev => ({ ...prev, error: data.error }));
    });

  }, []);

  // カウントダウン開始（Room Leader専用）
  const startCountdown = useCallback(() => {
    setLocalGameState(prevState => {
      if (!prevState.isRoomLeader) {
        console.log('🚫 Not Room Leader, cannot start countdown');
        return prevState;
      }

      // 既存のタイマーをクリア
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }

      console.log('👑 Room Leader starting countdown...');

      const countdownInterval = setInterval(() => {
        setLocalGameState(prev => {
          const newCountdown = prev.countdown - 1;

          // 共通データを他のクライアントに配信
          if (socketRef.current?.connected && roomNumberRef.current) {
            const sharedState: SharedGameState = {
              countdown: newCountdown,
              gameStarted: newCountdown <= 0,
              gameOver: prev.gameOver,
              participantCount: prev.participantCount
            };

            const data: GamePong42Data = {
              type: 'sharedState',
              playerId: playerIdRef.current!,
              timestamp: Date.now(),
              payload: sharedState
            };

            // データを直接送信
            socketRef.current.emit('gamepong42-data', {
              roomNumber: roomNumberRef.current,
              payload: data
            });
          }

          if (newCountdown <= 0) {
            clearInterval(countdownInterval);
            countdownTimerRef.current = null;
            console.log('🎮 Room Leader: Game started!');

            // ゲーム開始
            return {
              ...prev,
              countdown: 0,
              gameStarted: true
            };
          }

          console.log(`⏰ Room Leader countdown: ${newCountdown}`);
          return {
            ...prev,
            countdown: newCountdown
          };
        });
      }, 1000);

      countdownTimerRef.current = countdownInterval as any;
      return prevState;
    });
  }, []);

  // WebRTCデータ送信
  const sendData = useCallback((data: GamePong42Data) => {
    if (socketRef.current?.connected && roomNumberRef.current) {
      socketRef.current.emit('gamepong42-data', {
        roomNumber: roomNumberRef.current,
        payload: data
      });
    }
  }, []);

  // 部屋に参加
  const joinRoom = useCallback((roomNumber: string, playerInfo: PlayerInfo) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Cannot join room: Socket.IO not connected');
      return;
    }

    console.log('🏠 Joining GamePong42 room for data relay:', roomNumber);
    socketRef.current.emit('join-gamepong42-room', {
      roomNumber,
      playerInfo
    });
  }, []);

  // 切断
  const disconnect = useCallback(() => {
    // タイマーをクリア
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setState({
      connected: false,
      error: null,
    });
  }, []);

  // プレイヤー入力送信
  const sendPlayerInput = useCallback((input: any) => {
    if (!playerIdRef.current) return;

    const data: GamePong42Data = {
      type: 'playerInput',
      playerId: playerIdRef.current,
      timestamp: Date.now(),
      payload: input
    };

    sendData(data);
  }, [sendData]);

  // ゲーム状態送信
  const sendGameState = useCallback((gameState: any) => {
    if (!playerIdRef.current) return;

    const data: GamePong42Data = {
      type: 'gameState',
      playerId: playerIdRef.current,
      timestamp: Date.now(),
      payload: gameState
    };

    sendData(data);
  }, [sendData]);

  return {
    // 接続状態
    connected: state.connected,
    error: state.error,

    // ローカルゲーム状態
    gameState: localGameState,

    // 受信データ
    receivedData,

    // 接続管理
    connect,
    disconnect,
    joinRoom,

    // データ送信
    sendPlayerInput,
    sendGameState,
    sendData,

    // プレイヤー情報
    playerId: playerIdRef.current,
    roomNumber: roomNumberRef.current,
  };
};
