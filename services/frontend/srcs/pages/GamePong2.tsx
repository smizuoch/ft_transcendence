import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import type { NPCConfig } from "@/utils/npcTypes";
import { NPCSettingsPanel } from "@/utils/NPCSettingsPanel";
import { NPCDebugPanel } from "@/utils/NPCDebugPanel";
import { multiplayerService, type PlayerInput, type RoomState } from "@/utils/multiplayerService";
// NPCアルゴリズムの登録を確実に行うためにインポート
import "@/utils/npcAlgorithmRegistry";

interface PlayerInfo {
  id: number | string;
  avatar: string;
}

interface GamePong2Props {
  navigate: (page: string, userId?: string, roomNumber?: string) => void;
  roomNumber?: string;
  players?: {
    player1: PlayerInfo;
    player2: PlayerInfo;
  };
}

const ICON_PATH = "/images/icons/";

const defaultPlayers = {
  player1: { id: 1, avatar: "/images/avatar/default_avatar.png" },
  player2: { id: 2, avatar: "/images/avatar/default_avatar1.png" },
};

const GamePong2: React.FC<GamePong2Props> = ({ navigate, roomNumber: propRoomNumber, players = defaultPlayers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameOver, setGameOver] = useState(false);  const [winner, setWinner] = useState<number | null>(null);  const [roomNumber, setRoomNumber] = useState<string>('');
  const [showRoomInput, setShowRoomInput] = useState(true);
  const [hoverClose, setHoverClose] = useState(false);
  const [iconsDocked, setIconsDocked] = useState(false);
  const ICON_LAUNCH_DELAY = 600;
  // ============= 通信対戦関連の状態 =============
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [multiplayerConnected, setMultiplayerConnected] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);
  const [isGameReady, setIsGameReady] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2 | null>(null);
  const [remotePlayerInput, setRemotePlayerInput] = useState<PlayerInput | null>(null);

  // 未使用変数の警告を抑制（将来的なUI表示用）
  void multiplayerConnected;
  void roomPlayers;
  void isGameReady;// ============= NPC関連の状態 =============
  const [npcEnabled, setNpcEnabled] = useState(false);
  const [npcSettings, setNpcSettings] = useState<NPCConfig>({
    player: 1 as 1 | 2, // Player 1 (上)に固定
    mode: 'technician' as any, // technicianに固定
    enabled: false,
    reactionDelay: 0.05, // 50ms
    positionNoise: 2,
    followGain: 0.9,
    difficulty: 'Nightmare' as 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom',
    returnRate: 0.99,
    reactionDelayMs: 50, // 50ms固定
    maxSpeed: 1.2,
    trackingNoise: 2,
    trackingTimeout: 10000,
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
      courseAccuracy: 0.9
    }
  });
  const [npcDebugInfo, setNpcDebugInfo] = useState<{
    state: string;
    timeInState: number;
    returnRate: number;
    targetPosition: number;
    pid?: { error: number; p: number; i: number; d: number; output: number };
  } | null>(null);

  const { engineRef, initializeEngine, startGameLoop, stopGameLoop } = useGameEngine(canvasRef, DEFAULT_CONFIG);
  const keysRef = useKeyboardControls();
  // engineRefの未使用警告を抑制（NPC機能が無効化されているため）
  void engineRef;  // ============= 通信対戦のセットアップ =============
  useEffect(() => {
    // NPCモードの場合は部屋入力をスキップ
    if (npcEnabled) {
      setShowRoomInput(false);
      return;
    }    const setupMultiplayer = async () => {
      try {
        // 既に接続されている場合は何もしない
        if (multiplayerService.isConnectedToServer()) {
          console.log('Already connected to multiplayer service');
          setMultiplayerConnected(true);
          return;
        }

        await multiplayerService.connect();
        setMultiplayerConnected(true);

        // 通信対戦のイベントリスナーを設定
        multiplayerService.on('roomJoined', (data: RoomState) => {
          setPlayerNumber(data.playerNumber);
          setRoomPlayers(data.players);
          setIsGameReady(data.isGameReady);
          console.log(`Joined as player ${data.playerNumber}`);
          setShowRoomInput(false); // 部屋入力画面を隠す
        });

        multiplayerService.on('playerJoined', (data: any) => {
          setRoomPlayers(data.players || []);
          setIsGameReady(data.isGameReady);
        });        multiplayerService.on('gameReady', (data: any) => {
          setIsGameReady(true);
          setRoomPlayers(data.players);
        });

        multiplayerService.on('gameStarted', (data: { roomNumber: string; players: any[]; initiator: string }) => {
          console.log('Game started by player:', data.initiator);
          // ゲーム開始処理を実行
          if (engineRef.current) {
            engineRef.current.updateNPCConfig({ enabled: false });
          }
          setGameStarted(true);
          setGameOver(false);
          setWinner(null);
          setScore({ player1: 0, player2: 0 });
        });

        multiplayerService.on('gameStartFailed', (data: { reason: string; currentPlayers: number }) => {
          console.log('Game start failed:', data.reason);
          alert(`ゲーム開始に失敗しました: ${data.reason} (現在のプレイヤー数: ${data.currentPlayers})`);
        });

        multiplayerService.on('playerInputUpdate', (data: { playerId: string; playerNumber: 1 | 2; input: PlayerInput }) => {
          // 他のプレイヤーの入力を受信
          if (data.playerNumber !== playerNumber) {
            setRemotePlayerInput(data.input);
          }
        });

        multiplayerService.on('playerLeft', () => {
          setIsGameReady(false);
          setRoomPlayers([]);
        });

      } catch (error) {
        console.error('Failed to setup multiplayer:', error);
        setMultiplayerConnected(false);
      }
    };

    // 通信対戦のセットアップを一度だけ実行
    if (!multiplayerService.isConnectedToServer()) {
      setupMultiplayer();
    }

    // コンポーネントアンマウント時のみ部屋から離脱
    return () => {
      // ページ遷移や終了時のみ部屋から離脱
    };  }, [npcEnabled]);

  // ============= コンポーネントアンマウント時の部屋離脱 =============
  useEffect(() => {
    return () => {
      // コンポーネントがアンマウントされる時のみ部屋から離脱
      if (multiplayerService.isInRoom()) {
        multiplayerService.leaveRoom();
        console.log('Left room due to component unmount');
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      initializeEngine();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      stopGameLoop();
    };
  }, [initializeEngine, stopGameLoop]);

  const handleScore = useCallback((scorer: 'player1' | 'player2') => {
    setScore((prev) => {
      const newScore = { ...prev, [scorer]: prev[scorer] + 1 };
      if (newScore[scorer] >= DEFAULT_CONFIG.winningScore) {
        setGameOver(true);
        setWinner(scorer === 'player1' ? 1 : 2);
      }
      return newScore;
    });  }, []);  useEffect(() => {
    if (gameStarted) {
      // 通信対戦時は入力送信とゲーム状態同期を行う
      if (isMultiplayer && multiplayerService.isInRoom()) {
        // 自分の入力を他のプレイヤーに送信
        const sendInputs = () => {          if (keysRef.current) {
            const input: PlayerInput = {
              up: keysRef.current.arrowLeft,  // 左移動をupにマッピング
              down: keysRef.current.arrowRight, // 右移動をdownにマッピング
              timestamp: Date.now()
            };
            multiplayerService.sendPlayerInput(input);
          }
        };

        // ゲームループでの入力送信
        const inputInterval = setInterval(sendInputs, 16); // 60fps

        startGameLoop(handleScore, gameStarted, keysRef, '#212121', npcEnabled, remotePlayerInput);

        return () => {
          clearInterval(inputInterval);
          stopGameLoop();
        };
      } else {        // 通常のゲームループ（ローカル/NPC対戦）
        startGameLoop(handleScore, gameStarted, keysRef, '#212121', npcEnabled, null);
      }
    } else {
      stopGameLoop();
    }

    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef, npcEnabled, isMultiplayer, remotePlayerInput]);

  useEffect(() => {
    if (!gameStarted) return;
    setIconsDocked(false);
    const t = setTimeout(() => setIconsDocked(true), ICON_LAUNCH_DELAY);
    return () => clearTimeout(t);
  }, [gameStarted]);

  useEffect(() => {
    if (gameOver && winner) {
      const t = setTimeout(() => navigate("GameResult"), 1200);
      return () => clearTimeout(t);
    }
  }, [gameOver, winner, navigate]);  const handleStartGame = useCallback(() => {
    // マルチプレイヤーモードの場合、サーバーにゲーム開始要求を送信
    if (isMultiplayer && isGameReady) {
      console.log('Requesting to start multiplayer game...');
      multiplayerService.startGame();
      return;
    }

    // NPCモードまたはマルチプレイヤーが準備完了の場合のみゲーム開始
    if (npcEnabled) {
      // PVEモード: Player1 = technicianNPC, Player2 = プレイヤー
      if (engineRef.current) {
        engineRef.current.updateNPCConfig({
          ...npcSettings,
          enabled: true,
          player: 1, // Player1をNPCに設定
          mode: 'technician', // technicianNPCに固定
          difficulty: 'Nightmare', // Nightmare難易度に固定
          reactionDelayMs: 50, // 50ms固定
        });
      }
      setGameStarted(true);
    } else if (isMultiplayer && isGameReady) {
      // PVPモード: マルチプレイヤーが準備完了
      if (engineRef.current) {
        engineRef.current.updateNPCConfig({ enabled: false });
      }
      setGameStarted(true);
    } else if (!isMultiplayer) {
      // ローカルPVPモード
      if (engineRef.current) {
        engineRef.current.updateNPCConfig({ enabled: false });
      }
      setGameStarted(true);
    }

    if (gameStarted) {
      setGameOver(false);
      setWinner(null);
      setScore({ player1: 0, player2: 0 });
    }
  }, [npcEnabled, npcSettings, engineRef, isMultiplayer, isGameReady, gameStarted]);

  // ============= NPC状態のデバッグ情報更新 =============
  useEffect(() => {
    if (!gameStarted || !npcEnabled) return;

    const interval = setInterval(() => {
      if (engineRef.current) {
        setNpcDebugInfo(engineRef.current.getNPCDebugInfo());
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameStarted, npcEnabled]);

  const renderAvatarGroup = (idx: 1 | 2, side: "left" | "right") => {
    const pts = idx === 1 ? score.player1 : score.player2;
    const translateClass = side === "left"
      ? (iconsDocked ? "-translate-x-full" : "")
      : (iconsDocked ? "translate-x-full" : "");
    const positionClass = side === "left"
      ? "left-0 bottom-16"
      : "right-0 top-16";
    const initialPosition = iconsDocked ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";

    return (
      <div
        className={`absolute flex items-center gap-3 select-none pointer-events-none transition-all duration-700 ease-out ${
          side === "right" ? "flex-row-reverse" : ""
        } ${iconsDocked ? positionClass : initialPosition} ${translateClass}`}
      >
        {/* outer score */}
        {pts >= DEFAULT_CONFIG.winningScore ? (
          <img src={`${ICON_PATH}win.svg`} alt="win" className="w-12 h-12 lg:w-16 lg:h-16" />
        ) : (
          <span className="text-white font-extrabold text-6xl lg:text-8xl leading-none">{pts}</span>
        )}
        {/* inner avatar */}
        <img
          src={players[idx === 1 ? "player1" : "player2"].avatar}
          alt="avatar"
          className="w-12 h-12 lg:w-16 lg:h-16 rounded-full shadow-lg"
        />
      </div>
    );  };  // ============= propRoomNumberの処理 =============
  useEffect(() => {
    if (propRoomNumber && !multiplayerService.isInRoom()) {
      setRoomNumber(propRoomNumber);
      setShowRoomInput(false);
      // 部屋番号が渡された場合は自動的にマルチプレイヤーモードに設定
      setIsMultiplayer(true);

      // マルチプレイヤーサービスが接続されていない場合は接続を待つ
      const autoJoinRoom = async () => {
        try {
          // 既に部屋に参加している場合は何もしない
          if (multiplayerService.isInRoom()) {
            console.log('Already in room, skipping join');
            return;
          }

          // 接続済みの場合はそのまま部屋に参加
          if (!multiplayerService.isConnectedToServer()) {
            await multiplayerService.connect();
            setMultiplayerConnected(true);
          }

          const playerInfo = {
            id: '',
            avatar: players.player2.avatar,
            name: 'Player'
          };

          await multiplayerService.joinRoom(propRoomNumber, playerInfo);
          console.log(`Auto-joining room: ${propRoomNumber}`);
        } catch (error) {
          console.error('Auto join room failed:', error);
          alert('部屋への参加に失敗しました');
          setMultiplayerConnected(false);
        }
      };

      // 少し遅延を入れてマルチプレイヤーサービスの初期化を待つ
      setTimeout(autoJoinRoom, 100);
    }
  }, [propRoomNumber, players.player2.avatar]);

  // ============= ハンドラー関数 =============
  const handleRoomNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 数字のみ許可
    if (value.length <= 6) {
      setRoomNumber(value);
    }
  };
  const handleJoinRoom = async () => {
    if (roomNumber.length < 4) {
      alert('部屋番号は4桁以上で入力してください');
      return;
    }

    // 既に部屋に参加している場合は警告
    if (multiplayerService.isInRoom()) {
      alert('既に部屋に参加しています');
      return;
    }

    try {
      if (!multiplayerService.isConnectedToServer()) {
        await multiplayerService.connect();
        setMultiplayerConnected(true);
      }

      // 部屋に参加
      const playerInfo = {
        id: '',
        avatar: players.player2.avatar, // 自分のアバター
        name: 'Player'
      };

      await multiplayerService.joinRoom(roomNumber, playerInfo);
      setIsMultiplayer(true);

    } catch (error) {
      console.error('Failed to join room:', error);
      alert('部屋への参加に失敗しました');
      setMultiplayerConnected(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-[Futura]">
      {/* BG cover */}
      <img
        src="/images/background/noon.png"
        alt="bg"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* central content */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {/* play square */}
        <div className="relative" style={{ width: "90vmin", height: "90vmin" }}>
          <canvas ref={canvasRef} className="w-full h-full border border-white" />

          {/* avatar groups */}
          {gameStarted && !gameOver && (
            <>
              {renderAvatarGroup(1, "right")}
              {renderAvatarGroup(2, "left")}
            </>
          )}
        </div>        {/* opening screen */}
        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* 部屋入力画面 */}
            {showRoomInput && !npcEnabled ? (
              <div className="flex flex-col items-center gap-6 p-8 bg-black bg-opacity-50 rounded-lg">
                <div className="text-3xl text-white mb-4">部屋番号を入力</div>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={handleRoomNumberChange}
                  placeholder="4-6桁の数字"
                  className="px-4 py-2 text-2xl text-center border-2 border-white bg-transparent text-white placeholder-gray-300 rounded"
                  maxLength={6}
                />
                <button
                  onClick={handleJoinRoom}
                  disabled={roomNumber.length < 4}
                  className="px-8 py-3 text-xl bg-white text-black rounded hover:bg-gray-200 disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  部屋に参加
                </button>
              </div>
            ) : (
              <>
                <div className="text-5xl mb-4 tracking-widest" style={{ color: "#212121" }}>
                  {isMultiplayer ? roomNumber.toString().padStart(6, "0") : "PvP"}
                </div>                <img
                  src={`${ICON_PATH}${hoverClose ? "close" : "open"}.svg`}
                  alt="toggle"
                  className="w-40 h-40 cursor-pointer"
                  onMouseEnter={() => setHoverClose(true)}
                  onMouseLeave={() => setHoverClose(false)}
                  onClick={handleStartGame}
                />

                {/* マルチプレイヤー待機メッセージ */}
                {isMultiplayer && !isGameReady && (
                  <div className="text-2xl text-white mt-4">
                    他のプレイヤーを待っています...
                  </div>
                )}

                {/* マルチプレイヤー準備完了メッセージ */}
                {isMultiplayer && isGameReady && (
                  <div className="text-2xl text-white mt-4">
                    ドアをクリックしてゲーム開始！
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ============= NPC設定パネル ============= */}
      <NPCSettingsPanel
        npcEnabled={npcEnabled}
        setNpcEnabled={setNpcEnabled}
        npcSettings={npcSettings}
        setNpcSettings={setNpcSettings}
        gameStarted={gameStarted}
      />

      {/* ============= NPC状態デバッグ表示 ============= */}
      <NPCDebugPanel
        gameStarted={gameStarted}
        npcEnabled={npcEnabled}
        npcSettings={npcSettings}
        npcDebugInfo={npcDebugInfo}
      />
    </div>
  );
};

export default GamePong2;
