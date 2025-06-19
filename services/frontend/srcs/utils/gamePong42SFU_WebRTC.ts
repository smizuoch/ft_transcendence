import { useCallback, useEffect, useRef, useState } from 'react';
import { createGamePong42WebRTC, GamePong42WebRTC } from './gamePong42WebRTC';

interface GamePong42State {
  connected: boolean;
  error: string | null;
}

interface PlayerInfo {
  name: string;
  avatar?: string;
}

// プレイヤーのゲーム状態
interface PlayerGameState {
  playerId: string;
  playerName: string;
  gameState: {
    paddle1: { x: number; y: number; width: number; height: number };
    paddle2: { x: number; y: number; width: number; height: number };
    ball: { x: number; y: number; radius: number; dx: number; dy: number };
    canvasWidth: number;
    canvasHeight: number;
    score: { player1: number; player2: number };
  };
  timestamp: number;
  isActive: boolean;
}

// クライアント側で管理するゲーム状態の型定義
interface GamePong42LocalState {
  participantCount: number;
  countdown: number;
  gameStarted: boolean;
  gameOver: boolean;
  playerInfos: Map<string, PlayerInfo>;
  isRoomLeader: boolean;
  roomLeaderId: string | null;
  connectedPlayers: Set<string>;
  playerGameStates: Map<string, PlayerGameState>; // 他のプレイヤーのゲーム状態
}

// WebRTC経由で中継するデータの型定義
interface GamePong42Data {
  type: 'playerInput' | 'gameState' | 'gameEvent' | 'ping' | 'sharedState' | 'roomLeader' | 'join-room' | 'leave-room' | 'npc-request' | 'game-start' | 'room-leader-countdown';
  playerId?: string;
  timestamp: number;
  payload: any;
}

const SFU_URL = () => {
  const hostname = window.location.hostname;
  // WebRTCにはHTTPS/WSSが必要なので、必ずhttpsを使用
  return `https://${hostname}:3042`;
};

// WebRTC関連の状態を管理するフック
export const useGamePong42SFU = () => {
  const [state, setState] = useState<GamePong42State>({
    connected: false,
    error: null,
  });

  const [localGameState, setLocalGameState] = useState<GamePong42LocalState>({
    participantCount: 1,
    countdown: 15,
    gameStarted: false,
    gameOver: false,
    playerInfos: new Map(),
    isRoomLeader: false,
    roomLeaderId: null,
    connectedPlayers: new Set(),
    playerGameStates: new Map(), // 他のプレイヤーのゲーム状態
  });

  const webrtcRef = useRef<GamePong42WebRTC | null>(null);
  const roomNumberRef = useRef<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const countdownStartedRef = useRef<boolean>(false); // カウントダウン開始済みフラグ
  const [receivedData, setReceivedData] = useState<GamePong42Data[]>([]);

  const handleGameEvent = (data: GamePong42Data) => {
    const { payload } = data;

    switch (payload.action) {
      case 'countdown-start':
      case 'countdown-update':
        setLocalGameState(prev => ({ ...prev, countdown: payload.countdown }));
        break;
      case 'game-start':
        setLocalGameState(prev => ({ ...prev, gameStarted: true, countdown: 0 }));
        break;
    }
  };

  const handlePlayerGameState = (data: GamePong42Data) => {
    const { playerId, payload } = data;

    if (!playerId) return;

    setLocalGameState(prev => {
      const newPlayerGameStates = new Map(prev.playerGameStates);
      newPlayerGameStates.set(playerId, {
        playerId,
        playerName: `Player-${playerId.slice(-4)}`,
        gameState: payload,
        timestamp: data.timestamp,
        isActive: true
      });

      return { ...prev, playerGameStates: newPlayerGameStates };
    });
  };

  // Room Leaderのカウントダウン管理
  const startRoomLeaderCountdown = useCallback(() => {
    if (!localGameState.isRoomLeader || localGameState.gameStarted || countdownStartedRef.current) {
      return;
    }

    countdownStartedRef.current = true; // フラグを設定

    // Clear existing timer
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    let countdownValue = 15;
    setLocalGameState(prev => ({ ...prev, countdown: countdownValue }));

    // Broadcast countdown start via WebRTC
    if (webrtcRef.current && webrtcRef.current.isConnected) {
      webrtcRef.current.sendData({
        type: 'gameEvent',
        payload: {
          action: 'countdown-start',
          countdown: countdownValue
        },
        timestamp: Date.now()
      });
    }

    countdownTimerRef.current = window.setInterval(() => {
      countdownValue--;
      setLocalGameState(prev => ({ ...prev, countdown: countdownValue }));

      // Broadcast countdown update via WebRTC
      if (webrtcRef.current && webrtcRef.current.isConnected) {
        webrtcRef.current.sendData({
          type: 'gameEvent',
          payload: {
            action: 'countdown-update',
            countdown: countdownValue
          },
          timestamp: Date.now()
        });
      }

      // Check for game start conditions
      if (localGameState.participantCount >= 42 || countdownValue <= 0) {
        clearInterval(countdownTimerRef.current!);
        countdownStartedRef.current = false; // フラグをリセット
        startGame();
      }
    }, 1000);
  }, [localGameState.isRoomLeader, localGameState.gameStarted, localGameState.participantCount]);

  // Room Leaderになったときのログ出力のみ（自動カウントダウンは削除）
  useEffect(() => {
    if (localGameState.isRoomLeader && !localGameState.gameStarted) {
      console.log('👑 Became Room Leader');
    }
  }, [localGameState.isRoomLeader, localGameState.gameStarted]);

  // Game start (Room Leader only)
  const startGame = useCallback(async () => {
    if (!localGameState.isRoomLeader || localGameState.gameStarted) {
      return;
    }

    setLocalGameState(prev => ({
      ...prev,
      gameStarted: true,
      countdown: 0
    }));

    // Start game via WebRTC
    if (webrtcRef.current && webrtcRef.current.isConnected) {
      await webrtcRef.current.startGameAsLeader();
    }
  }, [localGameState.isRoomLeader, localGameState.gameStarted]);

  // 接続状態を監視してWebRTCで接続
  const connect = useCallback(async () => {
    if (webrtcRef.current?.isConnected) {
      return;
    }

    try {
      const playerInfo: PlayerInfo = {
        name: `Player-${Date.now().toString().slice(-4)}`,
        avatar: '/images/avatar/default.png'
      };

      const webrtc = createGamePong42WebRTC({
        sfuUrl: SFU_URL(),
        playerInfo
      });

      // Set up event handlers
      webrtc.onConnectionStateChange = (connected: boolean) => {
        setState(prev => ({ ...prev, connected, error: connected ? null : 'Disconnected' }));
      };

      webrtc.onRoomJoined = (data) => {
        roomNumberRef.current = data.roomNumber;
        playerIdRef.current = `player-${Date.now()}`;

        setLocalGameState(prev => ({
          ...prev,
          participantCount: data.participantCount,
          isRoomLeader: data.isRoomLeader,
          roomLeaderId: data.isRoomLeader ? playerIdRef.current : prev.roomLeaderId
        }));
      };

      webrtc.onDataReceived = (data: any) => {
        setReceivedData(prev => [...prev.slice(-99), data]); // Keep last 100 messages

        // Handle different data types
        switch (data.type) {
          case 'gameEvent':
            handleGameEvent(data);
            break;
          case 'gameState':
            handlePlayerGameState(data);
            break;
          case 'playerInput':
            // Handle player input if needed
            break;
        }
      };

      webrtc.onError = (error: string) => {
        setState(prev => ({ ...prev, error }));
      };

      webrtcRef.current = webrtc;
      await webrtc.connect();

    } catch (error: any) {
      console.error('❌ WebRTC connection failed:', error);
      setState(prev => ({ ...prev, error: error.message || 'Connection failed' }));
    }
  }, []);

  // Send player game state
  const sendPlayerGameState = useCallback((gameState: any) => {
    if (webrtcRef.current && webrtcRef.current.isConnected) {
      webrtcRef.current.sendGameState(gameState);
    }
  }, []);

  // Send player input
  const sendPlayerInput = useCallback((input: any) => {
    if (webrtcRef.current && webrtcRef.current.isConnected) {
      webrtcRef.current.sendPlayerInput(input);
    }
  }, []);

  // Send player game over
  const sendPlayerGameOver = useCallback((gameOverData: {
    score: { player1: number; player2: number };
    winner: string;
    gameTime: number;
  }) => {
    if (webrtcRef.current && webrtcRef.current.isConnected) {
      webrtcRef.current.sendData({
        type: 'gameEvent',
        payload: {
          action: 'game-over',
          ...gameOverData
        },
        timestamp: Date.now()
      });
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (webrtcRef.current) {
      webrtcRef.current.disconnect();
      webrtcRef.current = null;
    }

    setState({ connected: false, error: null });
    setLocalGameState({
      participantCount: 1,
      countdown: 15,
      gameStarted: false,
      gameOver: false,
      playerInfos: new Map(),
      isRoomLeader: false,
      roomLeaderId: null,
      connectedPlayers: new Set(),
      playerGameStates: new Map(),
    });
  }, []);

  // Reset game state
  const resetGameState = useCallback(() => {
    setLocalGameState({
      participantCount: 1,
      countdown: 15,
      gameStarted: false,
      gameOver: false,
      playerInfos: new Map(),
      isRoomLeader: false,
      roomLeaderId: null,
      connectedPlayers: new Set(),
      playerGameStates: new Map(),
    });
    setReceivedData([]);
  }, []);

  // 他のプレイヤーのゲーム状態管理
  const gameState = {
    playerGameStates: localGameState.playerGameStates,
    gameStarted: localGameState.gameStarted,
    countdown: localGameState.countdown
  };

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Room Leaderの場合、一定時間後に自動でカウントダウンを開始
  useEffect(() => {
    if (localGameState.isRoomLeader && !localGameState.gameStarted && !countdownStartedRef.current) {
      // 2秒後にカウントダウン開始（他のプレイヤーの参加を待つ）
      const timer = setTimeout(() => {
        startRoomLeaderCountdown();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [localGameState.isRoomLeader, localGameState.gameStarted, startRoomLeaderCountdown]);

  // デバッグ情報
  const debugInfo = {
    playerId: playerIdRef.current,
    roomNumber: roomNumberRef.current,
    isRoomLeader: localGameState.isRoomLeader,
    participantCount: localGameState.participantCount,
    countdown: localGameState.countdown,
    gameStarted: localGameState.gameStarted,
    connectedPlayers: Array.from(localGameState.connectedPlayers),
    playerGameStatesCount: localGameState.playerGameStates.size,
    receivedDataCount: receivedData.length
  };

  return {
    // 接続状態
    connected: state.connected,
    error: state.error,

    // ゲーム状態
    participantCount: localGameState.participantCount,
    countdown: localGameState.countdown,
    gameStarted: localGameState.gameStarted,
    gameOver: localGameState.gameOver,
    isRoomLeader: localGameState.isRoomLeader,
    roomLeaderId: localGameState.roomLeaderId,
    connectedPlayers: localGameState.connectedPlayers,
    playerGameStates: localGameState.playerGameStates,

    // 識別子
    playerId: playerIdRef.current,
    roomNumber: roomNumberRef.current,

    // アクション
    connect,
    disconnect,
    startRoomLeaderCountdown,
    sendPlayerGameState,
    sendPlayerInput,
    sendPlayerGameOver,
    resetGameState,

    // データ
    receivedData,

    // デバッグ
    debugInfo,

    // WebRTC specific
    webrtc: webrtcRef.current,
    gameState,
  };
};
