import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import type { NPCConfig } from "@/utils/npcTypes";
import { NPCSettingsPanel } from "@/utils/NPCSettingsPanel";
import { NPCDebugPanel } from "@/utils/NPCDebugPanel";
import { SpectatorPanel } from "@/utils/SpectatorPanel";
import { multiplayerService, type PlayerInput, type RoomState } from "@/utils/multiplayerService";
import { localMultiplayerService, type LocalClient, type LocalRoomState } from "@/utils/localMultiplayerService";
import { LocalPlayerInput } from "@/utils/LocalPlayerInput";
import { LocalGamePanel } from "@/utils/LocalGamePanel";
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
  const ICON_LAUNCH_DELAY = 600;  // ============= 通信対戦関連の状態 =============
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [multiplayerConnected, setMultiplayerConnected] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);
  const [roomSpectators, setRoomSpectators] = useState<any[]>([]); // 観戦者リスト
  const [isGameReady, setIsGameReady] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2 | 'spectator' | null>(null);
  const [remotePlayerInput, setRemotePlayerInput] = useState<PlayerInput | null>(null);
  const [isAuthoritativeClient, setIsAuthoritativeClient] = useState(false); // 権威クライアントかどうか
  const [isSpectator, setIsSpectator] = useState(false); // 観戦者モードかどうか

  // 未使用変数の警告を抑制（将来的なUI表示用）
  void multiplayerConnected;
  void roomPlayers;
  void roomSpectators;
  void isGameReady;  // ============= NPC関連の状態 =============
  const [npcEnabled, setNpcEnabled] = useState(false);
  
  // ============= ローカル対戦関連の状態 =============
  const [localEnabled, setLocalEnabled] = useState(false);
  const [showLocalPlayerInput, setShowLocalPlayerInput] = useState(false);
  const [localRoomState, setLocalRoomState] = useState<LocalRoomState | null>(null);
  
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

  const { engineRef, initializeEngine, startGameLoop, stopGameLoop } = useGameEngine(canvasRef as React.RefObject<HTMLCanvasElement>, DEFAULT_CONFIG);
  const keysRef = useKeyboardControls();
  // engineRefの未使用警告を抑制（NPC機能が無効化されているため）
  void engineRef;  // ============= 通信対戦のセットアップ =============
  useEffect(() => {
    // NPCモードまたはローカルモードの場合は部屋入力をスキップ
    if (npcEnabled || localEnabled) {
      setShowRoomInput(false);
      return;
    }const setupMultiplayer = async () => {
      try {
        // 既に接続されている場合は何もしない
        if (multiplayerService.isConnectedToServer()) {
          console.log('Already connected to multiplayer service');
          setMultiplayerConnected(true);
          return;
        }

        await multiplayerService.connect();
        setMultiplayerConnected(true);        // 通信対戦のイベントリスナーを設定
        multiplayerService.on('roomJoined', (data: RoomState) => {
          setPlayerNumber(data.playerNumber);
          setRoomPlayers(data.players);
          setRoomSpectators(data.spectators || []);
          setIsGameReady(data.isGameReady);
          setIsSpectator(data.isSpectator || data.playerNumber === 'spectator');
          console.log(`Joined as ${data.isSpectator ? 'spectator' : `player ${data.playerNumber}`}`);
          setShowRoomInput(false); // 部屋入力画面を隠す
          
          // Player1を権威クライアント（ゲーム状態の管理者）に設定、観戦者は非権威
          const isAuth = data.playerNumber === 1;
          setIsAuthoritativeClient(isAuth);
          if (engineRef.current) {
            engineRef.current.setAuthoritativeClient(isAuth);
          }
        });

        multiplayerService.on('playerJoined', (data: any) => {
          setRoomPlayers(data.players || []);
          setRoomSpectators(data.spectators || []);
          setIsGameReady(data.isGameReady);
        });        multiplayerService.on('gameReady', (data: any) => {
          console.log('Game ready data:', data);
          setIsGameReady(true);
          setRoomPlayers(data.players);
          console.log(`Game is now ready! Players: ${data.players.length}`);
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
        });        // 完全なゲーム状態の同期
        multiplayerService.on('fullGameStateUpdate', (data: { playerId: string; gameState: any }) => {
          if (engineRef.current) {
            // 観戦者または非権威クライアントはリモート状態を適用
            if (isSpectator || !isAuthoritativeClient) {
              engineRef.current.syncGameState(data.gameState);
            }
          }
        });

        // サーバーからのスコア更新
        multiplayerService.on('scoreUpdated', (data: { 
          scorer: 'player1' | 'player2'; 
          playerId: string; 
          scores: { player1: number; player2: number };
          gameOver: boolean;
          winner: number | null;
        }) => {
          // サーバー管理のスコアを直接適用
          setScore(data.scores);
          if (data.gameOver) {
            setGameOver(true);
            setWinner(data.winner);
          }
        });

        // サーバーからのゲーム終了
        multiplayerService.on('gameEnded', (data: { 
          winner: number; 
          playerId: string; 
          finalScores: { player1: number; player2: number };
        }) => {
          setScore(data.finalScores);
          setGameOver(true);
          setWinner(data.winner);
        });

      } catch (error) {
        console.error('Failed to setup multiplayer:', error);
        setMultiplayerConnected(false);
      }
    };    // 通信対戦のセットアップを一度だけ実行
    if (!multiplayerService.isConnectedToServer()) {
      setupMultiplayer();
    }

    // コンポーネントアンマウント時のみ部屋から離脱
    return () => {
      // ページ遷移や終了時のみ部屋から離脱
    };  }, [npcEnabled, localEnabled]);
  // ============= コンポーネントアンマウント時の部屋離脱 =============
  useEffect(() => {
    return () => {
      // コンポーネントがアンマウントされる時のみ部屋から離脱
      if (multiplayerService.isInRoom()) {
        multiplayerService.leaveRoom();
        console.log('Left room due to component unmount');
      }
      if (localMultiplayerService.isInLocalRoom()) {
        localMultiplayerService.leaveLocalRoom();
        console.log('Left local room due to component unmount');
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
        const winnerNumber = scorer === 'player1' ? 1 : 2;
        setWinner(winnerNumber);
        
        // ローカル対戦の場合はローカルサービスでゲーム終了処理
        if (localEnabled && localRoomState) {
          localMultiplayerService.onGameEnd(winnerNumber);
        }
      }
      return newScore;
    });
  }, [localEnabled, localRoomState]);useEffect(() => {
    if (gameStarted) {
      // ローカル対戦時
      if (localEnabled && localRoomState) {
        // ローカル対戦のゲームループ
        const hasNPC = localMultiplayerService.hasNPC();
        startGameLoop(handleScore, gameStarted, keysRef, '#212121', hasNPC, null, null);
      }
      // 通信対戦時は入力送信とゲーム状態同期を行う
      else if (isMultiplayer && multiplayerService.isInRoom()) {// 観戦者の場合は入力を送信しない
        if (!isSpectator && multiplayerService.isPlayer()) {
          const sendInputs = () => {
            if (keysRef.current) {
              let up = false;
              let down = false;              if (playerNumber === 1) {
                // P1は画面が180度回転しているので、送信する入力も反転
                up = keysRef.current['arrowLeft'] || keysRef.current['a'];
                down = keysRef.current['arrowRight'] || keysRef.current['d'];
              } else if (playerNumber === 2) {
                // P2は通常の制御
                up = keysRef.current['arrowLeft'] || keysRef.current['a'];
                down = keysRef.current['arrowRight'] || keysRef.current['d'];
              }

              multiplayerService.sendPlayerInput({
                up: up || false,
                down: down || false,
                timestamp: Date.now()
              });
            }
          };
          
          // ゲームループでの入力送信
          const inputInterval = setInterval(sendInputs, 16); // 60fps

          startGameLoop(handleScore, gameStarted, keysRef, '#212121', npcEnabled, remotePlayerInput, playerNumber);

          return () => {
            clearInterval(inputInterval);
            stopGameLoop();
          };        } else if (isSpectator) {
          // 観戦者モードの場合は入力を完全に無効化してゲームループのみ実行
          const emptyKeysRef = { current: {} }; // 空のキーリファレンス
          startGameLoop(handleScore, gameStarted, emptyKeysRef, '#212121', false, remotePlayerInput, 'spectator');
        }
      } else {
        // 通常のゲームループ（ローカル/NPC対戦）
        startGameLoop(handleScore, gameStarted, keysRef, '#212121', npcEnabled, null, playerNumber);
      }
    } else {
      stopGameLoop();
    }    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef, npcEnabled, localEnabled, localRoomState, isMultiplayer, isSpectator, remotePlayerInput, playerNumber]);

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
  }, [gameOver, winner, navigate]);

  // マルチプレイヤー時のゲームエンジンコールバック設定
  useEffect(() => {
    if (gameStarted && isMultiplayer && engineRef.current) {      // 権威クライアントのみゲーム状態送信コールバックを設定
      if (isAuthoritativeClient) {
        engineRef.current.setGameStateUpdateCallback((gameState) => {
          multiplayerService.sendFullGameState(gameState);
        });

        engineRef.current.setScoreUpdateCallback((scorer) => {
          multiplayerService.sendScoreUpdate(scorer);
        });
      }
    }  }, [gameStarted, isMultiplayer, isAuthoritativeClient]);

  // ============= ローカル対戦のイベントリスナー =============
  useEffect(() => {
    if (!localEnabled) return;

    const handleLocalRoomJoined = (roomState: LocalRoomState) => {
      setLocalRoomState(roomState);
      setShowRoomInput(false);
      console.log('Local room joined:', roomState);
    };

    const handleLocalGameStarted = (roomState: LocalRoomState) => {
      console.log('Local game started:', roomState);
      setGameStarted(true);
      setGameOver(false);
      setWinner(null);
      setScore({ player1: 0, player2: 0 });
    };    const handleLocalGameEnded = (data: {
      winner: number;
      winnerPlayer: LocalClient;
      loserPlayer: LocalClient;
      finalScores: { player1: number; player2: number };
      roomState: LocalRoomState;
    }) => {
      console.log('Local game ended:', data);
      setScore(data.finalScores);
      setGameOver(true);
      setWinner(data.winner);
      setLocalRoomState(data.roomState);

      // 次のゲームまたは結果画面への遷移
      setTimeout(() => {
        const result = localMultiplayerService.proceedToNext();
        console.log('Transition result:', {
          action: result.action,
          roomNumber: result.roomNumber,
          hasRoomState: !!result.roomState
        });

        if (result.action === 'nextGame' && result.roomNumber && result.roomState) {
          console.log('Setting up next game with room:', result.roomNumber);

          // 現在のサービス状態をクリア
          localMultiplayerService.leaveLocalRoom();

          // 次のゲーム用に新しい部屋をセットアップ
          localMultiplayerService.setupNextGame(result.roomState)
            .then(() => {
              console.log('Successfully set up next game, navigating to:', result.roomNumber);
              // 次のゲームに遷移
              navigate('GamePong2', undefined, result.roomNumber);
            })
            .catch((error) => {
              console.error('Failed to setup next game:', error);
              // エラーの場合は結果画面に遷移
              console.log('Falling back to GameResult due to setup error');
              navigate('GameResult');
            });
        } else {
          // 結果画面に遷移
          console.log('Navigating to GameResult, reason:', result.action === 'result' ? 'Not enough alive players' : 'Missing room data');
          navigate('GameResult');
        }
      }, 2000);
    };

    localMultiplayerService.on('localRoomJoined', handleLocalRoomJoined);
    localMultiplayerService.on('localGameStarted', handleLocalGameStarted);
    localMultiplayerService.on('localGameEnded', handleLocalGameEnded);

    return () => {
      localMultiplayerService.off('localRoomJoined', handleLocalRoomJoined);
      localMultiplayerService.off('localGameStarted', handleLocalGameStarted);
      localMultiplayerService.off('localGameEnded', handleLocalGameEnded);
    };
  }, [localEnabled, navigate]);
  // ============= ハンドラー関数 =============
  const handleLocalPlayersConfirmed = useCallback((clients: LocalClient[]) => {
    console.log('Local players confirmed:', clients);
    localMultiplayerService.setupLocalMultiplayer(roomNumber, clients);
    setShowLocalPlayerInput(false);
  }, [roomNumber]);
  const handleLocalCancel = useCallback(() => {
    setShowLocalPlayerInput(false);
    setLocalEnabled(false);
  }, []);

  const handleLocalEnabled = useCallback((enabled: boolean) => {
    setLocalEnabled(enabled);
    if (enabled) {
      setNpcEnabled(false); // ローカルを有効にしたらNPCを無効化
      setShowLocalPlayerInput(true); // 参加者入力画面を表示
    }
  }, []);

  const handleStartGame = useCallback(() => {
    // ローカル対戦モードの場合
    if (localEnabled && localRoomState) {
      console.log('Starting local multiplayer game...');
      
      // NPCが含まれている場合はNPCを有効化
      if (localMultiplayerService.hasNPC()) {
        if (engineRef.current) {
          engineRef.current.updateNPCConfig({
            enabled: true,
            player: 1, // Player1をNPCに設定
            mode: 'technician',
            difficulty: 'Nightmare',
            reactionDelayMs: 50,
          });
        }
      } else {
        // NPCを無効化
        if (engineRef.current) {
          engineRef.current.updateNPCConfig({ enabled: false });
        }
      }
      
      setGameStarted(true);
      return;
    }
    
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
    } else if (!isMultiplayer && !localEnabled) {
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
  }, [npcEnabled, npcSettings, engineRef, isMultiplayer, isGameReady, gameStarted, localEnabled, localRoomState]);

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

  const renderAvatarGroup = (idx: 1 | 2, side: "left" | "right") => {    // 自分のプレイヤー番号に基づいてスコアとアバターを決定
    let displayedScore;
    let avatarPlayerKey: "player1" | "player2";
    
    if (isMultiplayer && playerNumber) {
      // マルチプレイヤーの場合：左=自分、右=相手
      const isMyScore = (side === "left");
      if (isMyScore) {
        // 自分のスコアとアバター
        displayedScore = playerNumber === 1 ? score.player1 : score.player2;
        avatarPlayerKey = playerNumber === 1 ? "player1" : "player2";
      } else {
        // 相手のスコアとアバター  
        displayedScore = playerNumber === 1 ? score.player2 : score.player1;
        avatarPlayerKey = playerNumber === 1 ? "player2" : "player1";
      }
    } else {
      // ローカルゲーム/NPCモードの場合は従来通り
      displayedScore = idx === 1 ? score.player1 : score.player2;
      avatarPlayerKey = idx === 1 ? "player1" : "player2";
    }
    
    const pts = displayedScore;
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
        )}        {/* inner avatar */}
        <img
          src={players[avatarPlayerKey].avatar}
          alt="avatar"
          className="w-12 h-12 lg:w-16 lg:h-16 rounded-full shadow-lg"
        />
      </div>
    );  };  // ============= propRoomNumberの処理 =============
  useEffect(() => {
    if (propRoomNumber) {
      setRoomNumber(propRoomNumber);
      setShowRoomInput(false);
      
      // ローカル対戦の場合はマルチプレイヤーモードを無効化
      if (localEnabled) {
        setIsMultiplayer(false);
        console.log('Received room number for local tournament:', propRoomNumber);
        return;
      }

      // 通信対戦の場合の処理
      if (!multiplayerService.isInRoom()) {
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
    }
  }, [propRoomNumber, players.player2.avatar, localEnabled]);

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
      setIsMultiplayer(true);    } catch (error) {
      console.error('Failed to join room:', error);
      alert('部屋への参加に失敗しました');
      setMultiplayerConnected(false);
    }  };

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
          <canvas 
            ref={canvasRef} 
            className={`w-full h-full border border-white ${playerNumber === 1 ? 'rotate-180' : ''}`}
          />          {/* avatar groups */}
          {gameStarted && !gameOver && (
            <>              {isMultiplayer && playerNumber ? (
                <>
                  {/* マルチプレイヤー：常に左=自分、右=相手 */}
                  {renderAvatarGroup(1, "left")}   {/* 左側は自分 */}
                  {renderAvatarGroup(1, "right")}  {/* 右側は相手 */}
                </>
              ) : (
                <>
                  {/* ローカルゲーム/NPCモード：従来通り */}
                  {renderAvatarGroup(1, "right")}
                  {renderAvatarGroup(2, "left")}
                </>
              )}
            </>
          )}
        </div>        {/* opening screen */}
        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">            {/* 部屋入力画面 */}
            {showRoomInput && !npcEnabled && !localEnabled ? (
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
              <>                <div className="text-5xl mb-4 tracking-widest" style={{ color: "#212121" }}>
                  {isMultiplayer ? roomNumber.toString().padStart(6, "0") : 
                   localEnabled ? "ローカル" : "PvP"}
                </div><img
                  src={`${ICON_PATH}${hoverClose ? "close" : "open"}.svg`}
                  alt="toggle"
                  className="w-40 h-40 cursor-pointer"
                  onMouseEnter={() => setHoverClose(true)}
                  onMouseLeave={() => setHoverClose(false)}
                  onClick={handleStartGame}
                />                {/* マルチプレイヤー待機メッセージ */}
                {isMultiplayer && !isGameReady && (
                  <div className="text-2xl text-white mt-4">
                    他のプレイヤーを待っています...
                    <div className="text-sm text-gray-300 mt-2">
                      デバッグ: Players: {roomPlayers.length}, Ready: {isGameReady.toString()}
                    </div>
                  </div>
                )}                {/* マルチプレイヤー準備完了メッセージ */}
                {isMultiplayer && isGameReady && (
                  <div className="text-2xl text-white mt-4">
                    ドアをクリックしてゲーム開始！
                  </div>
                )}                {/* ローカル対戦準備完了メッセージ */}
                {localEnabled && localRoomState && (
                  <div className="text-center mt-4">
                    <div className="text-2xl text-white mb-2">
                      ドアをクリックしてトーナメント開始！
                    </div>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>参加者: {localRoomState.clients.filter(c => c.id !== 'npc-technician').length}人</div>
                      <div className="text-yellow-400">
                        🥊 対戦: {localRoomState.players.map(p => p.name).join(' vs ')}
                      </div>
                      {localRoomState.spectators.filter(s => s.stillAlive).length > 0 && (
                        <div className="text-blue-400">
                          👥 待機: {localRoomState.spectators.filter(s => s.stillAlive).map(s => s.name).join(', ')}
                        </div>
                      )}
                      {localRoomState.tournament && (
                        <div className="text-green-400">
                          📍 {localRoomState.tournament.currentMatch === 'semifinal1' ? 'Semifinal 1' : 
                              localRoomState.tournament.currentMatch === 'semifinal2' ? 'Semifinal 2' : 
                              localRoomState.tournament.currentMatch === 'final' ? 'Final' : 'Tournament'} 
                          (部屋: {localRoomState.roomNumber})
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>      {/* ============= NPC設定パネル ============= */}
      <NPCSettingsPanel
        npcEnabled={npcEnabled}
        setNpcEnabled={setNpcEnabled}
        npcSettings={npcSettings}
        setNpcSettings={setNpcSettings}
        gameStarted={gameStarted}
        localEnabled={localEnabled}
        setLocalEnabled={handleLocalEnabled}
      />

      {/* ============= NPC状態デバッグ表示 ============= */}
      <NPCDebugPanel
        gameStarted={gameStarted}
        npcEnabled={npcEnabled}
        npcSettings={npcSettings}
        npcDebugInfo={npcDebugInfo}
      />      {/* ============= 観戦者パネル ============= */}
      {isSpectator && (
        <SpectatorPanel
          roomPlayers={roomPlayers}
          roomSpectators={roomSpectators}
          currentUserId={multiplayerService.getPlayerId() || undefined}
          score={score}
          gameStarted={gameStarted}
        />
      )}

      {/* ============= ローカル対戦プレイヤー入力 ============= */}
      {showLocalPlayerInput && (
        <LocalPlayerInput
          onPlayersConfirmed={handleLocalPlayersConfirmed}
          onCancel={handleLocalCancel}
        />
      )}

      {/* ============= ローカル対戦パネル ============= */}
      {localEnabled && localRoomState && (
        <LocalGamePanel
          roomState={localRoomState}
          score={score}
          gameStarted={gameStarted}
        />
      )}
    </div>
  );
};

export default GamePong2;
