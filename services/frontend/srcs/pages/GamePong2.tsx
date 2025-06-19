import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import { isUserAuthenticated } from "@/utils/authUtils";
import type { NPCConfig } from "@/utils/npcTypes";
import { SpectatorPanel } from "@/utils/SpectatorPanel";
import { DTLSDebugPanel } from "@/utils/DTLSDebugPanel";
import { multiplayerService, type PlayerInput, type RoomState } from "@/utils/multiplayerService";
import { apiClient } from "@/utils/authApi";
import "@/utils/npcAlgorithmRegistry";

interface PlayerInfo {
  id: number | string;
  avatar: string;
  name?: string;
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
  player1: { id: 1, avatar: "/images/avatar/default_avatar.png", name: "Player 1" },
  player2: { id: 2, avatar: "/images/avatar/default_avatar1.png", name: "Player 2" },
};

const GamePong2: React.FC<GamePong2Props> = ({ navigate, roomNumber: propRoomNumber, players = defaultPlayers }) => {
  // JWT認証チェック
  useEffect(() => {
    if (!isUserAuthenticated()) {
      // console.log('❌ GamePong2: User not authenticated, redirecting to Home');
      navigate('Home');
      return;
    }
  }, [navigate]);

  // ============= ユーザー情報取得関連の状態 =============
  const [realPlayers, setRealPlayers] = useState<{
    player1: PlayerInfo;
    player2: PlayerInfo;
  }>({
    player1: { id: 1, avatar: "/images/avatar/default_avatar.png", name: "Player 1" },
    player2: { id: 2, avatar: "/images/avatar/default_avatar1.png", name: "Player 2" },
  });

  const [isLoadingUserData, setIsLoadingUserData] = useState(true);

  // ============= APIからユーザー情報を取得 =============
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          // console.log('No auth token found, using default players');
          setIsLoadingUserData(false);
          return;
        }

        const response = await fetch('/api/user-search/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          const userData = result.data;

          // 自分の情報をplayer1として設定
          setRealPlayers(prev => ({
            ...prev,
            player1: {
              id: userData.username,
              avatar: userData.profileImage || "/images/avatar/default_avatar.png",
              name: userData.username || "Player 1"
            }
          }));
          // console.log('User data loaded:', userData);
        } else {
          console.error('Failed to fetch user data');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoadingUserData(false);
      }
    };

    fetchUserData();
  }, []);

  // ============= 対戦相手のプロフィールデータを取得 =============
  const fetchOpponentProfile = async (username: string): Promise<PlayerInfo> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        // console.log('No auth token found for opponent profile');
        return { id: username, avatar: "/images/avatar/default_avatar1.png", name: username };
      }

      const response = await fetch(`/api/user-search/profile/${username}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        const opponentData = result.data;
        return {
          id: opponentData.username,
          avatar: opponentData.profileImage || "/images/avatar/default_avatar1.png",
          name: opponentData.username
        };
      } else {
        console.error('Failed to fetch opponent profile data');
        return { id: username, avatar: "/images/avatar/default_avatar1.png", name: username };
      }
    } catch (error) {
      console.error('Error fetching opponent profile data:', error);
      return { id: username, avatar: "/images/avatar/default_avatar1.png", name: username };
    }
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [showRoomInput, setShowRoomInput] = useState(true);
  const [hoverClose, setHoverClose] = useState(false);
  const [iconsDocked, setIconsDocked] = useState(false);
  const ICON_LAUNCH_DELAY = 600;

  // ============= 通信対戦関連の状態 =============
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [multiplayerConnected, setMultiplayerConnected] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);
  const [roomSpectators, setRoomSpectators] = useState<any[]>([]);
  const [isGameReady, setIsGameReady] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2 | 'spectator' | null>(null);
  const [remotePlayerInput, setRemotePlayerInput] = useState<PlayerInput | null>(null);
  const [isAuthoritativeClient, setIsAuthoritativeClient] = useState(false);  const [isSpectator, setIsSpectator] = useState(false);
  const [isResultSent, setIsResultSent] = useState(false);

  // 未使用変数の警告を抑制（将来的なUI表示用）
  void multiplayerConnected;
  void roomPlayers;
  void roomSpectators;
  void isGameReady;

  // ============= NPC関連の状態 =============
  const [npcEnabled, setNpcEnabled] = useState(false);
  const [npcSettings, setNpcSettings] = useState<NPCConfig>({
    player: 1 as 1 | 2,
    mode: 'technician' as any,
    enabled: false,
    reactionDelay: 0.05,
    positionNoise: 2,
    followGain: 0.9,
    difficulty: 'Nightmare' as 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom',
    returnRate: 0.99,
    reactionDelayMs: 50,
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

  // engineRefの未使用警告を抑制
  void engineRef;

  // ============= 通信対戦のセットアップ =============
  useEffect(() => {
    if (npcEnabled) {
      setShowRoomInput(false);
      return;
    }

    const setupMultiplayer = async () => {
      try {
        if (multiplayerService.isConnectedToServer()) {
          // console.log('Already connected to multiplayer service');
          setMultiplayerConnected(true);
          return;
        }

        await multiplayerService.connect();
        setMultiplayerConnected(true);

        // 通信対戦のイベントリスナーを設定
        multiplayerService.on('roomJoined', (data: RoomState) => {
          setPlayerNumber(data.playerNumber);
          setRoomPlayers(data.players);
          setRoomSpectators(data.spectators || []);
          setIsGameReady(data.isGameReady);
          setIsSpectator(data.isSpectator || data.playerNumber === 'spectator');
          // console.log(`Joined as ${data.isSpectator ? 'spectator' : `player ${data.playerNumber}`}`);
          setShowRoomInput(false);

          // 対戦相手の情報をrealPlayersに設定
          // console.log('roomJoined data received:', data);
          // console.log('Current playerId:', multiplayerService.getPlayerId());

          if (data.players && data.players.length > 0) {
            // console.log('All players in room:', data.players);

            const opponentPlayer = data.players.find(p => p.playerId !== multiplayerService.getPlayerId());
            if (opponentPlayer) {
              // console.log('Found opponent player:', opponentPlayer);
              // APIから対戦相手の詳細プロフィール（画像含む）を取得
              fetchOpponentProfile(opponentPlayer.playerInfo.id).then(opponentProfile => {
                setRealPlayers(prev => ({
                  ...prev,
                  player2: opponentProfile
                }));
                // console.log('Opponent player profile updated with API data:', opponentProfile);
              });
            } else {
              // console.log('No opponent player found in room');
            }
          } else {
            // console.log('No players data or empty players array');
          }

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

          // 新しく参加したプレイヤーが対戦相手の場合、情報を更新
          // console.log('playerJoined data received:', data);
          if (data.players && data.players.length > 0) {
            // console.log('All players after join:', data.players);

            const opponentPlayer = data.players.find((p: any) => p.playerId !== multiplayerService.getPlayerId());
            if (opponentPlayer) {
              // console.log('Found new opponent player:', opponentPlayer);
              // APIから対戦相手の詳細プロフィール（画像含む）を取得
              fetchOpponentProfile(opponentPlayer.playerInfo.id).then(opponentProfile => {
                setRealPlayers(prev => ({
                  ...prev,
                  player2: opponentProfile
                }));
                // console.log('New opponent player profile updated with API data:', opponentProfile);
              });
            } else {
              // console.log('No new opponent player found');
            }
          }
        });

        // participant-joinedイベントも追加で監視
        multiplayerService.on('participantJoined', (data: any) => {
          // console.log('participantJoined data received:', data);
          setRoomPlayers(data.players || []);
          setRoomSpectators(data.spectators || []);
          setIsGameReady(data.isGameReady);

          // 新しく参加したプレイヤーが対戦相手の場合、情報を更新
          if (data.players && data.players.length > 0) {
            // console.log('All players after participant join:', data.players);

            const opponentPlayer = data.players.find((p: any) => p.playerId !== multiplayerService.getPlayerId());
            if (opponentPlayer) {
              // console.log('Found participant opponent player:', opponentPlayer);
              // APIから対戦相手の詳細プロフィール（画像含む）を取得
              fetchOpponentProfile(opponentPlayer.playerInfo.id).then(opponentProfile => {
                setRealPlayers(prev => ({
                  ...prev,
                  player2: opponentProfile
                }));
                // console.log('Participant opponent player profile updated with API data:', opponentProfile);
              });
            }
          }
        });

        multiplayerService.on('gameReady', (data: any) => {
          // console.log('Game ready data:', data);
          setIsGameReady(true);
          setRoomPlayers(data.players);
          // console.log(`Game is now ready! Players: ${data.players.length}`);

          // ゲーム開始準備時にも対戦相手の情報を更新
          if (data.players && data.players.length > 0) {
            const opponentPlayer = data.players.find((p: any) => p.playerId !== multiplayerService.getPlayerId());
            if (opponentPlayer) {
              // APIから対戦相手の詳細プロフィール（画像含む）を取得
              fetchOpponentProfile(opponentPlayer.playerInfo.id).then(opponentProfile => {
                setRealPlayers(prev => ({
                  ...prev,
                  player2: opponentProfile
                }));
                // console.log('Game ready: Opponent player profile updated with API data:', opponentProfile);
              });
            } else {
              // console.log('Game ready: No opponent player found');
            }
          }
        });        multiplayerService.on('gameStarted', (data: { roomNumber: string; players: any[]; initiator: string }) => {
          console.log('Game started event received:', data);
          if (engineRef.current) {
            engineRef.current.updateNPCConfig({ enabled: false });
          }
          setGameStarted(true);
          setGameOver(false);
          setWinner(null);
          setScore({ player1: 0, player2: 0 });
          setIsResultSent(false);
          
          // ゲームが開始されたら入力UIを非表示に
          setShowRoomInput(false);
        });        // ゲーム終了イベントの処理
        multiplayerService.on('gameEnded', (data: { winner: number; playerId: string }) => {
          console.log('Game ended event received:', data);
          setGameOver(true);
          setWinner(data.winner);
          setGameStarted(false);
        });

        // スコア更新イベント
        multiplayerService.on('scoreUpdated', (data: { scorer: 'player1' | 'player2'; playerId: string }) => {
          console.log('Score updated:', data);
          setScore(prev => ({
            ...prev,
            [data.scorer]: prev[data.scorer] + 1
          }));
        });

        multiplayerService.on('gameStartFailed', (data: { reason: string; currentPlayers: number }) => {
          // console.log('Game start failed:', data.reason);
          alert(`ゲーム開始に失敗しました: ${data.reason} (現在のプレイヤー数: ${data.currentPlayers})`);
        });

        multiplayerService.on('playerInputUpdate', (data: { playerId: string; playerNumber: 1 | 2; input: PlayerInput }) => {
          if (data.playerNumber !== playerNumber) {
            setRemotePlayerInput(data.input);
          }
        });

        multiplayerService.on('playerLeft', () => {
          setIsGameReady(false);
          setRoomPlayers([]);
        });

        multiplayerService.on('fullGameStateUpdate', (data: { playerId: string; gameState: any }) => {
          if (engineRef.current) {
            if (isSpectator || !isAuthoritativeClient) {
              engineRef.current.syncGameState(data.gameState);
            }
          }
        });

        multiplayerService.on('scoreUpdated', (data: {
          scorer: 'player1' | 'player2';
          playerId: string;
          scores: { player1: number; player2: number };
          gameOver: boolean;
          winner: number | null;
        }) => {
          setScore(data.scores);
          if (data.gameOver) {
            setGameOver(true);
            setWinner(data.winner);
          }
        });        multiplayerService.on('gameEnded', (data: {
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
        // 認証エラーの場合はHomeページにリダイレクト
        if (error instanceof Error && error.message.includes('Authentication required')) {
          // console.log('❌ GamePong2: Authentication error, redirecting to Home');
          navigate('Home');
        }
      }
    };

    if (!multiplayerService.isConnectedToServer()) {
      setupMultiplayer();
    }

    return () => {
      // ページ遷移や終了時のみ部屋から離脱
    };
  }, [npcEnabled]);

  // ============= コンポーネントアンマウント時の部屋離脱 =============
  useEffect(() => {
    return () => {
      if (multiplayerService.isInRoom()) {
        multiplayerService.leaveRoom();
        // console.log('Left room due to component unmount');
      }
    };
  }, []);

  useEffect(() => {
    // Initialize engine once, no resize handling for fixed size game
    initializeEngine();
    return () => {
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

        // ゲーム終了時に即座にゲームループを停止
        // console.log('🛑 Game ended, stopping game loop immediately');
        stopGameLoop();

        // ゲーム状態をリセット
        setGameStarted(false);
      }
      return newScore;
    });
  }, [stopGameLoop]);

  useEffect(() => {
    if (gameStarted) {
      // 通信対戦時は入力送信とゲーム状態同期を行う
      if (isMultiplayer && multiplayerService.isInRoom()) {
        if (!isSpectator && multiplayerService.isPlayer()) {
          const sendInputs = () => {
            if (keysRef.current) {
              let up = false;
              let down = false;

              if (playerNumber === 1) {
                up = keysRef.current['arrowLeft'] || keysRef.current['a'];
                down = keysRef.current['arrowRight'] || keysRef.current['d'];
              } else if (playerNumber === 2) {
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

          const inputInterval = setInterval(sendInputs, 16);
          startGameLoop(handleScore, gameStarted, keysRef, '#212121', npcEnabled, remotePlayerInput, playerNumber);

          return () => {
            clearInterval(inputInterval);
            stopGameLoop();
          };
        } else if (isSpectator) {
          const emptyKeysRef = { current: {} };
          startGameLoop(handleScore, gameStarted, emptyKeysRef, '#212121', false, remotePlayerInput, 'spectator');
        }
      } else {
        // 通常のゲームループ（ローカル/NPC対戦）
        startGameLoop(handleScore, gameStarted, keysRef, '#212121', npcEnabled, null, playerNumber);
      }
    } else {
      stopGameLoop();
    }

    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef, npcEnabled, isMultiplayer, isSpectator, remotePlayerInput, playerNumber]);

  useEffect(() => {
    if (!gameStarted) return;
    setIconsDocked(false);
    const t = setTimeout(() => setIconsDocked(true), ICON_LAUNCH_DELAY);
    return () => clearTimeout(t);
  }, [gameStarted]);
  useEffect(() => {
    // ゲーム結果の送信処理（重複防止機能付き）
    if (gameOver && winner && !isResultSent) {
      setIsResultSent(true); // 即座に送信フラグを設定して重複を防ぐ

      const sendResult = async () => {
        try {
          // JWTを取得
          const token = apiClient.getStoredToken();
          if (!token) {
            console.error('JWT token not found');
            navigate("MyPage");
            return;
          }

          // JWTからユーザー名を取得
          const payload = JSON.parse(atob(token.split('.')[1]));
          const username = payload.username;

          // 対戦相手の名前を決定
          let opponentUsername = '';
          if (npcEnabled) {
            // NPC対戦の場合
            opponentUsername = 'NPC';
          } else if (isMultiplayer && realPlayers.player2.name) {
            // マルチプレイヤー対戦の場合
            opponentUsername = String(realPlayers.player2.name);
          } else {
            // その他の場合（デフォルト）
            opponentUsername = 'Unknown';
          }

          // 勝敗結果を決定
          let result: 'win' | 'lose';
          if (npcEnabled) {
            // NPCモード: NPCはplayer1、人間はplayer2
            result = winner === 2 ? 'win' : 'lose';
            // console.log('🎮 NPC Mode - Winner:', winner, 'Human result:', result);
          } else if (isMultiplayer && playerNumber) {
            // マルチプレイヤーモード: 自分のプレイヤー番号と勝者を比較
            result = winner === playerNumber ? 'win' : 'lose';
            // console.log('🎮 Multiplayer Mode - Winner:', winner, 'My number:', playerNumber, 'My result:', result);
          } else {
            // ローカルPvPモード（通常は使用されない）
            result = winner === 1 ? 'win' : 'lose';
            // console.log('🎮 Local PvP Mode - Winner:', winner, 'Result:', result);
          }          // 現在の日付を取得（ISO文字列形式YYYY-MM-DD）
          const today = new Date();
          const gameDate = today.toISOString().split('T')[0]; // YYYY-MM-DD形式

          // console.log('🏆 Saving GamePong2 result:', {
          //   username,
          //   opponentUsername,
          //   result,
          //   gameDate
          // });

          // ゲーム結果をresult_searchサービスに送信
          const response = await fetch('/api/results/pong2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              username,
              opponentUsername,
              result,
              gameDate
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to save game result: ${response.status}`);
          }

          // console.log('✅ GamePong2 result saved successfully');
        } catch (error) {
          console.error('Error while saving GamePong2 result:', error);
        } finally {
          // 処理が完了したら画面遷移（少し遅延を入れて結果表示を見せる）
          setTimeout(() => {
            // console.log('🚀 Navigating to MyPage');
            navigate("MyPage");
          }, 800);
        }
      };

      // 結果表示のために少し遅延を入れてから処理開始
      setTimeout(sendResult, 400);
    }
  }, [gameOver, winner, navigate, npcEnabled, isMultiplayer, realPlayers.player2.name, isResultSent, playerNumber]);

  // マルチプレイヤー時のゲームエンジンコールバック設定
  useEffect(() => {
    if (gameStarted && isMultiplayer && engineRef.current) {
      if (isAuthoritativeClient) {
        engineRef.current.setGameStateUpdateCallback((gameState) => {
          multiplayerService.sendFullGameState(gameState);
        });
        engineRef.current.setScoreUpdateCallback((scorer) => {
          multiplayerService.sendScoreUpdate(scorer);
        });
      }
    }
  }, [gameStarted, isMultiplayer, isAuthoritativeClient]);
  const handleStartGame = useCallback(() => {
    // ゲーム開始時にフラグをリセット
    setIsResultSent(false);

    // マルチプレイヤーモードで相手がいない場合、自動的にNPCモードに切り替え
    if (isMultiplayer && !isGameReady) {
      // console.log('No opponent found, switching to NPC mode...');
      setIsMultiplayer(false);
      setNpcEnabled(true);
      // NPCの設定
      if (engineRef.current) {
        engineRef.current.updateNPCConfig({
          ...npcSettings,
          enabled: true,
          player: 1,
          mode: 'technician',
          difficulty: 'Nightmare',
          reactionDelayMs: 50,
        });
      }
      setGameStarted(true);
      return;
    }

    // マルチプレイヤーモードの場合、サーバーにゲーム開始要求を送信
    if (isMultiplayer && isGameReady) {
      // console.log('Requesting to start multiplayer game...');
      multiplayerService.startGame();
      return;
    }

    // NPCモードの場合
    if (npcEnabled) {
      if (engineRef.current) {
        engineRef.current.updateNPCConfig({
          ...npcSettings,
          enabled: true,
          player: 1,
          mode: 'technician',
          difficulty: 'Nightmare',
          reactionDelayMs: 50,
        });
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
  // ============= 簡潔化されたrenderAvatarGroup関数 =============
  const renderAvatarGroup = (side: "left" | "right") => {
    let displayedScore: number;
    let playerInfo: PlayerInfo;

    // NPCモードの場合
    if (npcEnabled) {
      // NPCモードでは左が人間（player2）、右がNPC（player1）
      if (side === "left") {
        displayedScore = score.player2;
        playerInfo = realPlayers.player1; // 人間プレイヤーの情報
      } else {
        displayedScore = score.player1;
        playerInfo = {
          id: "NPC",
          avatar: "/images/avatar/npc_avatar.png",
          name: "NPC"
        };
      }
    }
    // マルチプレイヤーモードの場合
    else if (isMultiplayer && playerNumber) {
      if (playerNumber === 1) {
        // プレイヤー1: キャンバスが180度回転しているため、アバターも入れ替えて表示
        if (side === "left") {
          displayedScore = score.player1;
          playerInfo = realPlayers.player1; // 自分のアバター
        } else {
          displayedScore = score.player2;
          playerInfo = realPlayers.player2; // 相手のアバター
        }
      } else {
        // プレイヤー2: 通常表示、左が相手、右が自分
        if (side === "left") {
          displayedScore = score.player2;
          playerInfo = realPlayers.player1; // 相手のアバター
        } else {
          displayedScore = score.player1;
          playerInfo = realPlayers.player2; // 自分のアバター
        }
      }
    }
    // ローカルPvPモードの場合
    else {
      if (side === "left") {
        displayedScore = score.player2;
        playerInfo = realPlayers.player2;
      } else {
        displayedScore = score.player1;
        playerInfo = realPlayers.player1;
      }
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
        {pts >= DEFAULT_CONFIG.winningScore ? (
          <img src={`${ICON_PATH}win.svg`} alt="win" className="w-12 h-12 lg:w-16 lg:h-16" />
        ) : (
          <span className="text-white font-extrabold text-6xl lg:text-8xl leading-none">{pts}</span>
        )}

        <div className="flex flex-col items-center gap-1">
          <img
            src={playerInfo.avatar}
            alt="avatar"
            className="w-12 h-12 lg:w-16 lg:h-16 rounded-full shadow-lg"
          />

          {playerInfo.name && (
            <span className="text-white text-xs lg:text-sm font-medium">
              {playerInfo.name}
            </span>
          )}
        </div>
      </div>
    );
  };

  // ============= propRoomNumberの処理 =============
  useEffect(() => {
    if (propRoomNumber) {
      setRoomNumber(propRoomNumber);
      setShowRoomInput(false);      // 通信対戦の場合の処理
      if (!npcEnabled) {
        setIsMultiplayer(true);
        const autoJoinRoom = async () => {
          try {
            // 既に同じ部屋にいる場合はそのまま続行
            if (multiplayerService.isInRoom() && multiplayerService.getRoomNumber() === propRoomNumber) {
              console.log(`Already in room ${propRoomNumber}, continuing...`);
              return;
            }

            if (!multiplayerService.isConnectedToServer()) {
              await multiplayerService.connect();
              setMultiplayerConnected(true);
            }

            // 別の部屋にいる場合は一度離脱
            if (multiplayerService.isInRoom() && multiplayerService.getRoomNumber() !== propRoomNumber) {
              console.log('Leaving current room to join new room...');
              multiplayerService.leaveRoom();
              // 状態をリセット
              setIsMultiplayer(false);
              setPlayerNumber(null);
              setIsGameReady(false);
              setIsSpectator(false);
              setRoomPlayers([]);
              setRoomSpectators([]);
              setIsAuthoritativeClient(false);
              
              // 少し待ってから新しい部屋に参加
              await new Promise(resolve => setTimeout(resolve, 200));
            }

            const playerInfo = {
              id: String(realPlayers.player1.id),
              avatar: realPlayers.player1.avatar,
              name: realPlayers.player1.name || 'Player'
            };

            await multiplayerService.joinRoom(propRoomNumber, playerInfo);
            setIsMultiplayer(true);
            console.log(`Auto-joined room: ${propRoomNumber}`);
          } catch (error) {
            console.error('Auto join room failed:', error);
            setMultiplayerConnected(false);
            // 認証エラーの場合はHomeページにリダイレクト
            if (error instanceof Error && error.message.includes('Authentication required')) {
              // console.log('❌ GamePong2: Authentication error, redirecting to Home');
              navigate('Home');
            } else {
              alert('部屋への参加に失敗しました');
            }
          }
        };
        setTimeout(autoJoinRoom, 100);
      }
    }
  }, [propRoomNumber, players.player2.avatar]);

  // ============= ハンドラー関数 =============
  const handleRoomNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 6) {
      setRoomNumber(value);
    }
  };  const handleJoinRoom = async () => {
    if (roomNumber.length < 4) {
      alert('部屋番号は4桁以上で入力してください');
      return;
    }

    try {
      if (!multiplayerService.isConnectedToServer()) {
        await multiplayerService.connect();
        setMultiplayerConnected(true);
      }

      // 既に同じ部屋にいる場合はそのまま続行
      if (multiplayerService.isInRoom() && multiplayerService.getRoomNumber() === roomNumber) {
        console.log('Already in the same room, continuing...');
        setIsMultiplayer(true);
        return;
      }

      // 別の部屋にいる場合は一度離脱してから新しい部屋に参加
      if (multiplayerService.isInRoom() && multiplayerService.getRoomNumber() !== roomNumber) {
        console.log('Leaving current room to join new room...');
        multiplayerService.leaveRoom();
        // 状態をリセット
        setIsMultiplayer(false);
        setPlayerNumber(null);
        setIsGameReady(false);
        setIsSpectator(false);
        setRoomPlayers([]);
        setRoomSpectators([]);
        setIsAuthoritativeClient(false);
        
        // 少し待ってから新しい部屋に参加
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const playerInfo = {
        id: String(realPlayers.player1.id),
        avatar: realPlayers.player1.avatar,
        name: realPlayers.player1.name || 'Player'
      };

      await multiplayerService.joinRoom(roomNumber, playerInfo);
      setIsMultiplayer(true);
    } catch (error) {
      console.error('Failed to join room:', error);
      setMultiplayerConnected(false);
      // 認証エラーの場合はHomeページにリダイレクト
      if (error instanceof Error && error.message.includes('Authentication required')) {
        // console.log('❌ GamePong2: Authentication error, redirecting to Home');
        navigate('Home');
      } else {
        alert('部屋への参加に失敗しました');
      }
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-[Futura]">
      <img
        src="/images/background/noon.png"
        alt="bg"
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <div className="relative w-[840px] h-[840px]">

          <canvas
            ref={canvasRef}
            className={`border border-white ${playerNumber === 1 && !npcEnabled ? 'rotate-180' : ''}`}
            style={{ width: '840px', height: '840px' }}
          />

          {gameStarted && !gameOver && (
            <>
              {renderAvatarGroup("left")}
              {renderAvatarGroup("right")}
            </>
          )}
        </div>

        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
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
                  {isMultiplayer ? roomNumber.toString().padStart(6, "0") :
                  npcEnabled ? "CPU対戦" : "PvP"}
                </div>
                <img
                  src={`${ICON_PATH}${hoverClose ? "close" : "open"}.svg`}
                  alt="toggle"
                  className="w-40 h-40 cursor-pointer"
                  onMouseEnter={() => setHoverClose(true)}
                  onMouseLeave={() => setHoverClose(false)}
                  onClick={handleStartGame}
                />
                {isMultiplayer && !isGameReady && (
                  <div className="text-2xl text-white mt-4">
                    他のプレイヤーを待っています...
                    <div className="text-sm text-gray-300 mt-2">
                      対戦相手が見つからない場合はCPU対戦に切り替わります
                    </div>
                  </div>
                )}
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

      {/* ============= 観戦者パネル ============= */}
      {/* {isSpectator && (
        <SpectatorPanel
          roomPlayers={roomPlayers}
          roomSpectators={roomSpectators}
          currentUserId={multiplayerService.getPlayerId() || undefined}
          score={score}
          gameStarted={gameStarted}
        />
      )} */}

      {/* ============= DTLS デバッグパネル ============= */}
      {/* {isMultiplayer && (
        <DTLSDebugPanel
          multiplayerService={multiplayerService}
          visible={true}
        />
      )} */}
    </div>
  );
};

export default GamePong2;
