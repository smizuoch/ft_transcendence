import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gamePong42Hooks";
import { DEFAULT_CONFIG } from "@/utils/gamePong42Engine";
import { NPCGameResponse, NPCGameConfig } from "@/utils/npcManagerService";
import { useGamePong42SFU } from "@/utils/gamePong42SFU_WebRTC";
import { apiClient } from "@/utils/authApi";

// GamePong42専用のカスタムConfig（中央キャンバスでpidNPCを有効にする）
const GAMEPONG42_CONFIG = {
  ...DEFAULT_CONFIG,
  npc: {
    ...DEFAULT_CONFIG.npc,
    enabled: true,
    player: 1 as const, // Player1をpidNPCに設定
    mode: 'pid' as const,
    difficulty: 'Hard' as const, // EasyからHardに変更
  },
};

interface GamePong42Props {
  navigate: (page: string, userId?: string, roomNumber?: string, ranking?: number) => void;
}

// ミニゲーム用のインターフェイス（npc_managerサービス対応）
interface MiniGame {
  id: number;
  gameId: string | null; // npc_managerのゲームID
  active: boolean;
  gameState: NPCGameResponse | null;
  canvasSize: { width: number; height: number };
}

const GamePong42: React.FC<GamePong42Props> = ({ navigate }) => {
  // JWT認証チェック関数
  const isUserAuthenticated = (): boolean => {
    const token = apiClient.getStoredToken();

    if (!token) return false;

    try {
      // JWTの形式をチェック（Base64デコードして基本的な検証）
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('❌ Invalid JWT format');
        return false;
      }

      // ペイロードをデコード
      const payload = JSON.parse(atob(parts[1]));

      // トークンの有効期限をチェック
      if (payload.exp && payload.exp < Date.now() / 1000) {
        console.log('❌ Token expired');
        return false;
      }

      // 2FA完了済みのトークンかチェック（twoFactorPendingがtrueでない）
      const isAuthenticated = payload.twoFactorPending !== true;

      return isAuthenticated;
    } catch (error) {
      console.log('❌ JWT decode error:', error);
      return false;
    }
  };

  // 認証チェック用のuseEffect
  useEffect(() => {
    if (!isUserAuthenticated()) {
      console.log('❌ User not authenticated. Redirecting to Home.');
      navigate('Home');
      return;
    }
  }, [navigate]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(Math.floor(Math.random() * 41));
  const [showSurvivorsAlert, setShowSurvivorsAlert] = useState(false);
  const [attackAnimation, setAttackAnimation] = useState<{ targetIndex: number; duration: number } | null>(null);
  const [miniGamesReady, setMiniGamesReady] = useState(false);
  const [miniGamesDataReady, setMiniGamesDataReady] = useState(false);

  // ミニゲーム状態
  const [miniGames, setMiniGames] = useState<MiniGame[]>([]);
  // WebRTC SFUのhook（純粋なデータ中継）
  const sfu = useGamePong42SFU();

  // 各キャンバスの最後の更新時刻を追跡
  const [lastUpdateTimes, setLastUpdateTimes] = useState<Map<string, number>>(new Map());

  // 他のプレイヤーのゲーム状態を取得（全クライアントで同じ順序になるよう統一）
  const getOtherPlayerGames = useCallback(() => {
    const allPlayerGames = Array.from(sfu.playerGameStates.values());
    // 全クライアントで同じ順序になるよう、playerIdでソート（自分は除外）
    const sortedPlayerGames = allPlayerGames
      .filter((playerGame: any) => playerGame.isActive && playerGame.playerId !== sfu.playerId)
      .sort((a: any, b: any) => a.playerId.localeCompare(b.playerId));

    return sortedPlayerGames;
  }, [sfu.playerGameStates, sfu.playerId]);

  // プレイヤーゲームの更新時刻を記録（別のuseEffect）
  useEffect(() => {
    const allPlayerGames = Array.from(sfu.playerGameStates.values());
    // 全クライアントで同じ順序になるよう、playerIdでソート（自分は除外）
    const sortedPlayerGames = allPlayerGames
      .filter((playerGame: any) => playerGame.isActive && playerGame.playerId !== sfu.playerId)
      .sort((a: any, b: any) => a.playerId.localeCompare(b.playerId));

    if (sortedPlayerGames.length > 0) {
      setLastUpdateTimes(prev => {
        const newTimes = new Map(prev);
        let hasChanges = false;

        sortedPlayerGames.forEach(playerGame => {
          const key = `player-${playerGame.playerId}`;
          const prevTime = prev.get(key) || 0;
          if (playerGame.timestamp && playerGame.timestamp > prevTime) {
            newTimes.set(key, playerGame.timestamp);
            hasChanges = true;
          }
        });

        return hasChanges ? newTimes : prev;
      });
    }
  }, [sfu.gameState.playerGameStates, sfu.playerId]);

  const otherPlayerGames = getOtherPlayerGames();

  // 定期的に古いタイムスタンプをクリーンアップ（メモリ効率化）
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setLastUpdateTimes(prev => {
        const cleaned = new Map();
        prev.forEach((timestamp, canvasId) => {
          // 5分以上古いタイムスタンプは削除
          if (now - timestamp < 5 * 60 * 1000) {
            cleaned.set(canvasId, timestamp);
          }
        });

        return cleaned;
      });
    }, 30000); // 30秒ごとに非アクティブなプレイヤーをクリーンアップ

    return () => clearInterval(cleanupInterval);
  }, []);



  // プレイヤーゲーム状態の変化を監視してリアルタイム更新を強制
  const [, forceUpdate] = useState({});
  const forceRerender = useCallback(() => {
    forceUpdate({});
  }, []);

  // プレイヤーゲーム状態が変化したときにリアルタイム更新をトリガー
  useEffect(() => {
    if (otherPlayerGames.length > 0) {
      // 60fpsで更新をトリガー（約16.67ms間隔）
      const interval = setInterval(() => {
        forceRerender();
      }, 16);

      return () => clearInterval(interval);
    }
  }, [otherPlayerGames.length, forceRerender]);

  // SFUから取得する状態（Room Leaderが管理）
  const gameStarted = sfu.gameState.gameStarted;
  const countdown = sfu.gameState.countdown;
  const [survivors, setSurvivors] = useState(42); // 動的な生存者数

  // ゲーム開始済みフラグ（ローカル管理）
  const [gameInitialized, setGameInitialized] = useState(false);

  // 1秒以上更新されていないキャンバスかどうかを判定する関数
  const isCanvasStale = useCallback((canvasId: string): boolean => {
    // ゲームが開始されていない場合は、1秒ルールを適用しない
    if (!gameStarted) {
      return false;
    }

    const lastUpdate = lastUpdateTimes.get(canvasId);
    if (!lastUpdate) return false; // 初回は非表示にしない

    const now = Date.now();
    const isStale = (now - lastUpdate) > 1000; // 1秒以上更新なし

    return isStale;
  }, [lastUpdateTimes, gameStarted]);

  // 固定のプレイヤー情報
  const playerInfoRef = useRef({
    name: 'Player',
    avatar: '/images/avatar/default.png'
  });

  // Canvas初期化状態の追跡
  const canvasInitializedRef = useRef(false);
  const initRetryCountRef = useRef(0);
  const MAX_INIT_RETRIES = 50; // 5秒間リトライ

  // ゲームエンジンとキーボード制御を追加
  const { engineRef, initializeEngine, startGameLoop, stopGameLoop } = useGameEngine(canvasRef as React.RefObject<HTMLCanvasElement>, GAMEPONG42_CONFIG);
  const keysRef = useKeyboardControls();

  // コンポーネントマウント時にゲーム状態をリセット
  useEffect(() => {
    sfu.resetGameState();

    // ローカル状態もリセット
    setGameOver(false);
    setWinner(null);
    setSelectedTarget(Math.floor(Math.random() * 41));
    setShowSurvivorsAlert(false);
    setAttackAnimation(null);
    setMiniGamesReady(false);
    setMiniGamesDataReady(false);
    setMiniGames([]);
    setSurvivors(42);
    setGameInitialized(false); // ゲーム初期化フラグもリセット

    // Canvas初期化フラグもリセット
    canvasInitializedRef.current = false;
    initRetryCountRef.current = 0;
  }, []); // 空の依存配列でマウント時のみ実行

  // コンポーネントマウント時にCanvas要素を確実に初期化
  useEffect(() => {
    if (canvasInitializedRef.current) {
      return; // 既に初期化済み
    }

    // DOM がレンダリングされるまで待つ
    const initializeCanvasWhenReady = () => {
      // より緩和された条件: Canvas要素が存在し、サイズが取得できれば初期化
      if (canvasRef.current &&
          (canvasRef.current.offsetWidth > 0 || canvasRef.current.clientWidth > 0)) {
        initializeEngine();
        canvasInitializedRef.current = true;
        return;
      }

      initRetryCountRef.current++;
      if (initRetryCountRef.current < MAX_INIT_RETRIES) {
        setTimeout(initializeCanvasWhenReady, 100);
      }
    };

    // 最初の試行を少し遅延
    const timeoutId = setTimeout(initializeCanvasWhenReady, 200);
    return () => clearTimeout(timeoutId);
  }, [initializeEngine]);

  // SFUのローカルゲーム状態を監視してUIを更新
  useEffect(() => {
    const { gameState } = sfu;

    // ゲーム開始状態の反映
    if (gameState.gameStarted && !gameInitialized) {
      console.log('🎮 Game started locally - initializing mini games');

      // ゲーム開始時にCanvas初期化を確実に実行
      if (canvasRef.current && !canvasInitializedRef.current) {
        initializeEngine();
        canvasInitializedRef.current = true;
      }

      // NPCの数を計算（41 - プレイヤー数、中央のキャンバスは除く）
      const npcCount = Math.max(0, 41 - gameState.participantCount);

      // ゲーム開始時は常に生存者数を42に設定
      setSurvivors(42);

      if (npcCount > 0) {
        initMiniGames(npcCount);
      } else {
        setMiniGamesReady(true); // 42人満員の場合はNPCなし
      }

      // ゲーム初期化フラグを設定
      setGameInitialized(true);
    }
  }, [sfu.gameState, gameInitialized]);

  // Room Leaderがカウントダウンを開始するロジック（一度だけ実行）
  const countdownStartedRef = useRef(false);

  useEffect(() => {
    const { gameState } = sfu;

    // Room Leader確定時にカウントダウンを開始
    if (gameState.isRoomLeader &&
        !gameState.gameStarted &&
        gameState.participantCount > 0 &&
        !countdownStartedRef.current) {

      console.log('👑 Room Leader confirmed, auto-starting countdown');
      countdownStartedRef.current = true; // フラグを設定

      // 少し遅延してからカウントダウン開始（他のプレイヤーの参加を待つ）
      const timeoutId = setTimeout(() => {
        if (gameState.isRoomLeader && !gameState.gameStarted) { // 再確認
          sfu.startRoomLeaderCountdown();
        }
      }, 1000); // 1秒遅延（サーバー応答を待つ）

      return () => clearTimeout(timeoutId);
    }
  }, [sfu.gameState.isRoomLeader, sfu.gameState.participantCount, sfu]);



  // NPCデータの監視・処理（SFU経由でNPCデータを受信）
  useEffect(() => {
    sfu.receivedData.forEach(data => {      if (data.type === 'gameState' && data.playerId === 'npc-manager' && data.payload.npcStates) {
        // 生存者数の更新（常に42に固定、NPCが余分に作成されている問題への対処）
        const activeNPCCount = data.payload.npcStates.filter((npc: any) => npc.active !== false).length;
        // 理想的には activeNPCCount + participantCount = 42 であるべき
        // しかし現在NPCが1つ多く作成されているため、最大42に制限
        const totalSurvivors = Math.min(42, activeNPCCount + sfu.gameState.participantCount);

        setSurvivors(totalSurvivors);

        // NPCの状態をミニゲームに反映
        setMiniGames(prev => {
          // miniGames配列が空の場合、動的にプレースホルダーを作成
          if (prev.length === 0 && data.payload.npcStates.length > 0) {
            const miniCanvasSize = { width: 100, height: 100 };
            const dynamicGames: MiniGame[] = [];

            for (let i = 0; i < data.payload.npcStates.length; i++) {
              dynamicGames.push({
                id: i,
                gameId: null,
                active: false,
                gameState: null,
                canvasSize: miniCanvasSize,
              });
            }
            prev = dynamicGames;
          }

          if (prev.length === 0) {
            return prev;
          }

          const updated = [...prev];
          let updatedCount = 0;

          data.payload.npcStates.forEach((npcState: any, index: number) => {
            if (index < updated.length && updated[index] && npcState.active !== false) {
              updated[index] = {
                ...updated[index],
                gameState: {
                  gameId: npcState.gameId || `npc-${index}`,
                  gameState: npcState.gameState || npcState,
                  isRunning: npcState.isRunning !== false, // 明示的にfalseでない限りtrue
                  score: npcState.score || { player1: 0, player2: 0 }
                },
                active: true // NPCデータを受信した場合はアクティブ
              };
              updatedCount++;
            } else if (index < updated.length && updated[index] && npcState.active === false) {
              // NPCが脱落した場合は非アクティブに
              updated[index] = {
                ...updated[index],
                active: false
              };
            }
          });

          // NPCデータが更新された場合、データ読み込み完了をマーク
          if (updatedCount > 0) {
            setMiniGamesDataReady(true);
          }

          return updated;
        });
      }
    });
  }, [sfu.receivedData]);

  // NPCゲームの更新時刻を記録（別途処理）
  useEffect(() => {
    const npcData = sfu.receivedData.find(data =>
      data.type === 'gameState' && data.playerId === 'npc-manager' && data.payload.npcStates
    );

    if (npcData) {
      const now = Date.now();
      setLastUpdateTimes(prevTimes => {
        const newTimes = new Map(prevTimes);
        let hasChanges = false;

        npcData.payload.npcStates.forEach((npcState: any, index: number) => {
          if (npcState.active !== false) {
            const key = `npc-${index}`;
            if (!prevTimes.has(key) || now > (prevTimes.get(key) || 0)) {
              newTimes.set(key, now);
              hasChanges = true;
            }
          }
        });

        return hasChanges ? newTimes : prevTimes;
      });
    }
  }, [sfu.receivedData]);



  // キーボード入力をSFUに送信
  const sendPlayerInput = useCallback(() => {
    if (sfu.connected && gameStarted) {
      const input = {
        up: keysRef.current.ArrowUp || keysRef.current.KeyW,
        down: keysRef.current.ArrowDown || keysRef.current.KeyS,
        attack: selectedTarget ?? undefined
      };

      // 入力に変化がある場合のみ送信
      if (input.up || input.down || input.attack !== undefined) {
        sfu.sendPlayerInput(input);
      }
    }
  }, [sfu, gameStarted, selectedTarget]);

  // ゲーム状態送信（60fps）
  useEffect(() => {
    if (!gameStarted || !sfu.connected || !engineRef.current) {
      console.log('🟡 Game state sending stopped:', {
        gameStarted,
        sfuConnected: sfu.connected,
        engineExists: !!engineRef.current,
        isRoomLeader: sfu.gameState.isRoomLeader
      });
      return;
    }

    // console.log('🟢 Starting game state sending:', {
    //   gameStarted,
    //   sfuConnected: sfu.connected,
    //   engineExists: !!engineRef.current,
    //   isRoomLeader: sfu.gameState.isRoomLeader
    // });

    const sendGameState = () => {
      if (engineRef.current) {
        const gameState = engineRef.current.getState();
        sfu.sendGameState(gameState);
      }
    };

    const interval = setInterval(sendGameState, 1000 / 60); // 60fps
    return () => clearInterval(interval);
  }, [gameStarted, sfu, engineRef]);

  // 定期的にプレイヤー入力を送信
  useEffect(() => {
    if (!gameStarted) return;

    const inputInterval = setInterval(sendPlayerInput, 1000 / 60); // 60FPS
    return () => clearInterval(inputInterval);
  }, [gameStarted, sendPlayerInput]);



  // ミニゲーム初期化関数
  const initMiniGames = useCallback(async (npcCount: number) => {
    console.log(`🔧 Initializing ${npcCount} NPC games for 42-canvas layout (1 center + ${npcCount} NPCs + ${41 - npcCount} players = 42 total)`);

    // Room Leaderでない場合はNPCデータ受信用のプレースホルダーを作成
    if (!sfu.gameState.isRoomLeader) {
      const miniCanvasSize = { width: 100, height: 100 };
      const placeholderGames: MiniGame[] = [];

      // NPC数分のプレースホルダーを作成（NPCデータ受信に対応）
      for (let i = 0; i < npcCount; i++) {
        placeholderGames.push({
          id: i,
          gameId: null, // Room Leaderではないのでゲーム作成はしない
          active: false, // NPCデータ受信時にアクティブになる
          gameState: null,
          canvasSize: miniCanvasSize,
        });
      }

      setMiniGames(placeholderGames);
      setMiniGamesReady(true);
      return;
    }

    if (miniGames.length > 0) {
      return; // 既に初期化済みの場合はスキップ
    }

    const games: MiniGame[] = [];
    const miniCanvasSize = { width: 100, height: 100 };

    // NPCが0の場合（41人のプレイヤーで満員）はミニゲームを作成しない
    if (npcCount === 0) {
      setMiniGamesReady(true);
      return;
    }

    // NPC数分のNPC vs NPCゲームを作成
    for (let i = 0; i < npcCount; i++) {
      const gameConfig: NPCGameConfig = {
        canvasWidth: 100, // ミニゲーム用キャンバス横幅
        canvasHeight: 100, // ミニゲーム用キャンバス縦幅
        paddleWidthRatio: 0.1, // キャンバス幅の10%
        paddleHeightRatio: 0.015, // キャンバス高さの1.5%
        ballRadiusRatio: 0.02, // キャンバス幅の2%
        paddleSpeed: 10, // パドル速度を10に変更
        initialBallSpeed: 0.3, // 初期ボール速度を0.3に変更
        maxBallSpeed: 2.0, // ボール最大速度を2.0に変更
        npc: {
          enabled: true,
          player: 1,
          mode: 'pid',
          difficulty: 'Easy', // EasyからEasyのまま（要求通り）
        },
        npc2: {
          enabled: true,
          player: 2,
          mode: 'pid',
          difficulty: 'Nightmare', // Nightmare維持（要求通り）
        },
      };

      try {
        if (!sfu.createNPCGame) {
          throw new Error('sfu.createNPCGame is not available');
        }

        const result = await sfu.createNPCGame(gameConfig) as { success: boolean; gameId?: string; error?: string };

        if (result.success && result.gameId) {
          games.push({
            id: i,
            gameId: result.gameId,
            active: true,
            gameState: null,
            canvasSize: miniCanvasSize,
          });
        } else {
          console.error(`❌ Failed to create game ${i}:`, result.error);
          games.push({
            id: i,
            gameId: null,
            active: false,
            gameState: null,
            canvasSize: miniCanvasSize,
          });
        }
      } catch (error) {
        console.error(`💥 Error creating game ${i}:`, error);
        games.push({
          id: i,
          gameId: null,
          active: false,
          gameState: null,
          canvasSize: miniCanvasSize,
        });
      }
    }

    setMiniGames(games);
    setMiniGamesReady(true); // ミニゲーム初期化完了
  }, [miniGames.length, sfu.createNPCGame, sfu.connected, sfu.gameState.isRoomLeader]);

  // SFUサーバーに接続
  useEffect(() => {
    try {
      sfu.connect();
    } catch (error) {
      console.error('❌ Error calling SFU connect:', error);
    }

    // クリーンアップ
    return () => {
      sfu.disconnect();
    };
  }, []); // 初回のみ実行

  // 接続完了後に部屋に参加
  useEffect(() => {
    if (sfu.connected) {
      const playerInfo = playerInfoRef.current; // 固定のプレイヤー情報を使用
      const roomNumber = 'gamepong42-auto'; // プレースホルダー（サーバーが適切な部屋を選択）

      console.log('🟢 SFU connected, joining room:', {
        playerInfo,
        roomNumber,
        sfuConnected: sfu.connected
      });

      try {
        sfu.joinRoom(roomNumber, playerInfo);
      } catch (error) {
        console.error('❌ Error requesting room assignment:', error);
      }
    } else {
      console.log('🟡 SFU not connected yet');
    }
  }, [sfu.connected]);

  // ゲーム状態の監視
  useEffect(() => {
    // ゲーム開始状態の反映
    if (sfu.gameState.gameStarted && !gameStarted) {
      // NPCを上側（Player1）のみに設定
      if (engineRef.current) {
        engineRef.current.updateNPCConfig({
          player: 1 as 1 | 2, // Player 1 (上)がNPC
          mode: 'pid' as any,
          enabled: true,
          difficulty: 'Hard' as any, // EasyからHardに変更
        });
      }

      // NPCの数を計算（41 - プレイヤー数、中央のキャンバスは除く）
      const npcCount = Math.max(0, 41 - sfu.gameState.participantCount);
      if (npcCount > 0) {
        initMiniGames(npcCount);
      } else {
        setMiniGamesReady(true); // 42人満員の場合はNPCなし
      }
    }
  }, [sfu.gameState, gameStarted, engineRef]);



  // ゲームエンジン初期化（コンポーネントマウント時とリサイズ時）
  useEffect(() => {
    // canvasが利用可能になったら即座に初期化
    if (canvasRef.current) {
      initializeEngine();
    }

    const handleResize = () => {
      if (canvasRef.current) {
        initializeEngine();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      stopGameLoop();
    };
  }, [initializeEngine, stopGameLoop]);

  // Canvas要素が利用可能になったときの追加の初期化チェック
  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      initializeEngine();
    }
  }, [canvasRef.current, initializeEngine]);

  const getBackgroundImage = () => {
    if (survivors >= 33) return '/images/background/noon.png';
    if (survivors >= 22) return '/images/background/evening.png';
    if (survivors >= 6) return '/images/background/late_night.png';
    return '/images/background/daybreak.png';
  };

  // パドルとボールの色を取得
  const getPaddleAndBallColor = () => {
    if (survivors < 33) return '#ffffff';
    return '#212121';
  };

  // プレイヤー対pidNPCキャンバスの色を取得（赤色）
  const getPlayerVsNPCColor = () => {
    return '#ff0000'; // 赤色固定
  };

  const executeAutoAttack = useCallback(async () => {
    const currentTarget = selectedTarget;
    const currentMiniGames = miniGames;
    const currentSfu = sfu;

    if (currentTarget !== null) {
      // Show attack animation from center to target opponent
      setAttackAnimation({ targetIndex: currentTarget, duration: 1000 });
      setTimeout(() => setAttackAnimation(null), 1000);

      // 選択されたミニゲームにスピードブースト攻撃を適用
      const targetGame = currentMiniGames[currentTarget];
      if (targetGame?.active && targetGame.gameId) {
        try {
          await currentSfu.applySpeedBoostToNPCGame(targetGame.gameId);
        } catch (error) {
          console.error('Failed to apply speed boost:', error);
        }
      }

      // 新しいターゲットを選択（アクティブなゲームのみ）
      setTimeout(() => {
        const activeGames = currentMiniGames.filter((game, index) => game.active && index !== currentTarget);
        if (activeGames.length > 0) {
          const randomActiveGame = activeGames[Math.floor(Math.random() * activeGames.length)];
          const newTargetIndex = currentMiniGames.findIndex(game => game.id === randomActiveGame.id);
          setSelectedTarget(newTargetIndex);
        }
      }, 1000);
    }
  }, [selectedTarget, miniGames, sfu]);

  const handleScore = useCallback((scorer: 'player1' | 'player2') => {
    // GamePong42では得点システムではなく生存者システム
    if (scorer === 'player1') { // NPCが勝利した場合（Player1 = NPC）
      console.log('💀 Player lost to NPC - ending game');
      setGameOver(true);
      setWinner(1);
    }
    // プレイヤーが勝利した場合（Player2）は攻撃フェーズに移行
    if (scorer === 'player2') {
      console.log('⚡ Player defeated NPC - executing auto attack');
      // プレイヤーがNPCに勝利 - 自動攻撃実行
      executeAutoAttack();
    }
  }, [executeAutoAttack]);

  const handleStartGame = useCallback(() => {
    // NPCを上側（Player1）のみに設定
    if (engineRef.current) {
      engineRef.current.updateNPCConfig({
        player: 1 as 1 | 2, // Player 1 (上)がNPC
        mode: 'pid' as any, // getCurrentNPC() → 'pid'に変更（常にPID NPC）
        enabled: true,
        difficulty: 'Normal' as any,
      });
    }
  }, [engineRef]);

  // 安定したスコアハンドラーを作成
  const stableHandleScore = useCallback((scorer: 'player1' | 'player2') => {
    // GamePong42では得点システムではなく生存者システム
    if (scorer === 'player1') { // NPCが勝利した場合（Player1 = NPC）
      console.log('💀 Player lost to NPC - setting game over state');
      setGameOver(true);
      setWinner(1);
    }
    // プレイヤーが勝利した場合（Player2）は攻撃フェーズに移行
    if (scorer === 'player2') {
      console.log('⚡ Player defeated NPC - executing auto attack');
      // プレイヤーがNPCに勝利 - 自動攻撃実行
      const currentTarget = selectedTarget;
      const currentMiniGames = miniGames;
      const currentSfu = sfu;

      if (currentTarget !== null) {
        // Show attack animation from center to target opponent
        setAttackAnimation({ targetIndex: currentTarget, duration: 1000 });
        setTimeout(() => setAttackAnimation(null), 1000);

        // 選択されたミニゲームにスピードブースト攻撃を適用
        const targetGame = currentMiniGames[currentTarget];
        if (targetGame?.active && targetGame.gameId) {
          currentSfu.applySpeedBoostToNPCGame(targetGame.gameId).catch(error => {
            console.error('Failed to apply speed boost:', error);
          });
        }

        // 新しいターゲットを選択（アクティブなゲームのみ）
        setTimeout(() => {
          const activeGames = currentMiniGames.filter((game, index) => game.active && index !== currentTarget);
          if (activeGames.length > 0) {
            const randomActiveGame = activeGames[Math.floor(Math.random() * activeGames.length)];
            const newTargetIndex = currentMiniGames.findIndex(game => game.id === randomActiveGame.id);
            setSelectedTarget(newTargetIndex);
          }
        }, 1000);
      }
    }
  }, []);  // 依存配列を空にして安定化

  // ゲームループの統一管理
  useEffect(() => {
    // ゲーム開始時のみゲームループを開始
    if (gameStarted && canvasRef.current) {
      // エンジンが初期化されていない場合、まず初期化
      if (!engineRef.current) {
        initializeEngine();
      }

      // 少し遅延してからゲームループを開始（エンジン初期化を待つ）
      const timer = setTimeout(() => {
        startGameLoop(
          stableHandleScore, // onScore
          gameStarted, // gameStarted
          keysRef, // keysRef
          () => getPaddleAndBallColor(), // パドルとボールの色を関数として渡して動的に更新できるようにする
          true, // isPVEMode
          null, // remotePlayerInput
          2, // playerNumber（Player2）
          sfu.sendPlayerGameState // gameSender（ゲーム状態送信関数）
        );
      }, 100);

      return () => {
        clearTimeout(timer);
        stopGameLoop();
      };
    }
  }, [gameStarted, initializeEngine, startGameLoop, stopGameLoop, survivors]);

  // キャンバスマウント時の初期化
  useEffect(() => {
    if (canvasRef.current) {
      initializeEngine();
    }
  }, [initializeEngine]);

  // Show alert when survivors count reaches milestone
  useEffect(() => {
    if (survivors === 32 || survivors === 21 || survivors === 5) {
      setShowSurvivorsAlert(true);
      setTimeout(() => setShowSurvivorsAlert(false), 3000);
    }
  }, [survivors]);

  // リサイズ処理
  useEffect(() => {
    const handleResize = () => {
      // リサイズ時はキャンバスのみリサイズし、ボールやパドルの位置は相対的に維持
      if (canvasRef.current && engineRef.current) {
        const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
        canvasRef.current.width = size;
        canvasRef.current.height = size;

        // 既存のエンジンを使用してキャンバスサイズのみ更新
        engineRef.current.updateCanvasSize(size, size);
      }
    };

    window.addEventListener("resize", handleResize);

    // 初回の初期化
    if (canvasRef.current) {
      initializeEngine();
    }

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [initializeEngine]);

  // ゲーム終了時の処理（一度だけ実行）
  const gameOverProcessedRef = useRef(false);

  useEffect(() => {
    if (gameOver && winner && !gameOverProcessedRef.current) {
      gameOverProcessedRef.current = true; // 一度だけ実行するためのフラグ

      console.log('� Game over detected, navigating to result in 1.2 seconds');

      // 現在のアクティブプレイヤー数を取得してランキングを計算
      const allPlayerGames = Array.from(sfu.gameState.playerGameStates.values());
      const activePlayersCount = allPlayerGames.filter(playerGame => playerGame.isActive).length;
      const myRanking = activePlayersCount; // 脱落時の生存者数が順位

      // ゲーム終了をsfu42に通知
      sfu.sendGameOver(winner);

      // ゲームエンジンをクリーンアップしてスコア発生を防ぐ
      if (engineRef.current) {
        console.log('🛑 Cleaning up game engine due to game over');
        engineRef.current.cleanup();
      }

      // ゲームループを停止してメインループを完全に止める
      console.log('🛑 Stopping game loop due to game over');
      stopGameLoop();

      // ゲーム終了時にすべてのミニゲームを停止（非同期で実行）
      const stopAllMiniGames = async () => {
        const currentMiniGames = miniGames;
        for (const game of currentMiniGames) {
          if (game.gameId && game.active) {
            try {
              await sfu.stopNPCGame(game.gameId);
              console.log(`✅ Successfully stopped game ${game.gameId}`);
            } catch (error) {
              // ゲーム停止エラーを詳細にログ出力するが、処理は継続
              if (error instanceof Error) {
                console.warn(`⚠️ Could not stop game ${game.gameId}: ${error.message} (likely already stopped)`);
              } else {
                console.warn(`⚠️ Could not stop game ${game.gameId}: Unknown error (likely already stopped)`);
              }
            }
          }
        }
      };

      // ミニゲーム停止を非同期で実行（メイン処理をブロックしない）
      stopAllMiniGames().catch(error => {
        console.error('Error stopping mini games:', error);
      });

      // JWTを取得し、ゲーム結果をAPIに送信してから画面遷移
      const t = setTimeout(async () => {
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

          // 現在の日付を取得（ISO文字列形式YYYY-MM-DD）
          // サーバー側で new Date(gameDate) に変換されます
          const today = new Date();
          const gameDate = today.toISOString().split('T')[0]; // YYYY-MM-DD形式

          console.log('🏆 Saving game result:', { username, rank: survivors, gameDate });

          // ゲーム結果をresult_searchサービスに送信
          const response = await fetch('/api/results/pong42', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              username,
              rank: survivors,
              gameDate
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to save game result: ${response.status}`);
          }

          console.log('✅ Game result saved successfully');
        } catch (error) {
          console.error('Error while saving game result:', error);
        } finally {
          // 処理が完了したら画面遷移
          navigate("MyPage");
        }
      }, 1200);

      // クリーンアップ関数は必要ない（一度だけ実行なので）
    }
  }, [gameOver, winner, navigate, sfu, miniGames]);

  const handleTargetSelect = (index: number) => {
    if (miniGames[index]?.active) {
      setSelectedTarget(index);
    }
  };



  // Calculate target position for ray animation
  const getTargetPosition = (targetIndex: number) => {
    const isLeftSide = targetIndex < 21;
    const gridIndex = isLeftSide ? targetIndex : targetIndex - 21;
    const row = Math.floor(gridIndex / 3);
    const col = gridIndex % 3;

    const canvasSize = 12.8; // vmin
    const gap = 0.25; // rem converted to vmin approximation

    if (isLeftSide) {
      // Left side positioning
      const leftOffset = 4; // left-4 in vmin approximation
      const x = leftOffset + col * (canvasSize + gap) + canvasSize / 2;
      const y = 50 + (row - 3) * (canvasSize + gap); // centered vertically
      return { x: `${x}vmin`, y: `${y}vh` };
    } else {
      // Right side positioning
      const rightOffset = 4; // right-4 in vmin approximation
      const x = 100 - rightOffset - (2 - col) * (canvasSize + gap) - canvasSize / 2; // from right
      const y = 50 + (row - 3) * (canvasSize + gap); // centered vertically
      return { x: `${x}vw`, y: `${y}vh` };
    }
  };

  // Helper function for safe gameState property access
  const safeGetGameStateValue = (gameState: any, path: string, defaultValue: number = 0): number => {
    try {
      const keys = path.split('.');
      let value = gameState;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return defaultValue;
        }
      }
      return typeof value === 'number' ? value : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden font-[Futura]"
      style={{
        backgroundImage: `url(${getBackgroundImage()})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>

      {/* Left side opponents - 21 tables in 7x3 grid (21 out of 41) */}
      {gameStarted && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
          <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
            {Array.from({ length: 21 }).map((_, i) => {
              const otherPlayerGames = getOtherPlayerGames();
              const playerGameCount = otherPlayerGames.length;

              let gameToDisplay;
              let gameType;

              if (i < playerGameCount) {
                // 最初の部分：プレイヤーゲームを配置
                gameToDisplay = otherPlayerGames[i];
                gameType = 'player';
              } else {
                // 残りの部分：NPCゲームを配置（41 - プレイヤー数）
                const npcIndex = i - playerGameCount;
                const totalNpcNeeded = 41 - playerGameCount; // 中央除く41個からプレイヤー数を引く
                if (npcIndex < totalNpcNeeded && npcIndex < miniGames.length) {
                  gameToDisplay = miniGames[npcIndex];
                  gameType = 'npc';
                } else {
                  // NPCが不足している場合はプレースホルダー
                  gameToDisplay = null;
                  gameType = 'placeholder';
                }
              }

              // ⏰ 選択されたゲームタイプに基づいてキャンバスの古さをチェック
              const canvasId = gameType === 'player' ? `player-${gameToDisplay?.playerId}` : `npc-${i}`;
              const isStale = isCanvasStale(canvasId);

              if (isStale) {
                return null;
              }

              // 選択されたゲームの状態を取得
              const gameState = gameType === 'player' ? gameToDisplay?.gameState : gameToDisplay?.gameState?.gameState;

              // ゲーム状態の安全性チェック
              if (!gameState || !gameState.paddle1 || !gameState.paddle2 || !gameState.ball ||
                  typeof gameState.paddle1.x === 'undefined' || typeof gameState.paddle2.x === 'undefined' ||
                  typeof gameState.ball.x === 'undefined') {
                // ゲーム状態が不完全な場合は何も表示しない．
                return (null);
              }

              const isUnderAttack = false; // スピードブースト状態は別途管理が必要
              const isPlayerVsPlayer = gameType === 'player';

              return (
                <div
                  key={`left-${i}`}
                  className={`cursor-pointer transition-all duration-200 relative ${
                    selectedTarget === i ? 'scale-105' : 'hover:scale-102'
                  } ${isUnderAttack ? 'ring-2 ring-red-500 ring-opacity-75' : ''}`}
                  style={{ width: "12.8vmin", height: "12.8vmin" }}
                  onClick={() => handleTargetSelect(i)}
                >
                  {selectedTarget === i && (
                    <img
                      src="/images/icons/target_circle.svg"
                      alt="Target"
                      className="absolute inset-0 w-full h-full opacity-80 z-10"
                    />
                  )}

                  {/* 攻撃効果表示 */}
                  {isUnderAttack && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl z-20">
                      BOOST
                    </div>
                  )}

                  {/* NPC Manager-based mini pong game */}
                  <div className="w-full h-full border border-white relative overflow-hidden" style={{
                    backgroundColor: isUnderAttack ? "rgba(255,0,0,0.2)" : "rgba(255,255,255,0.15)"
                  }}>
                    {gameState && gameState.paddle1 && gameState.paddle2 && gameState.ball && gameState.canvasWidth && gameState.canvasHeight ? (
                      <>
                        {/* Player1 paddle */}
                        <div
                          className="absolute rounded"
                          style={{
                            left: `${Math.max(0, Math.min(100, (gameState.paddle1.x / gameState.canvasWidth) * 100))}%`,
                            top: `${Math.max(0, Math.min(100, (gameState.paddle1.y / gameState.canvasHeight) * 100))}%`,
                            width: `${Math.max(1, (gameState.paddle1.width / gameState.canvasWidth) * 100)}%`,
                            height: `${Math.max(1, (gameState.paddle1.height / gameState.canvasHeight) * 100)}%`,
                            backgroundColor: isPlayerVsPlayer ? getPlayerVsNPCColor() : getPaddleAndBallColor()
                          }}
                        ></div>

                        {/* Player2 paddle */}
                        <div
                          className="absolute rounded"
                          style={{
                            left: `${Math.max(0, Math.min(100, (gameState.paddle2.x / gameState.canvasWidth) * 100))}%`,
                            top: `${Math.max(0, Math.min(100, (gameState.paddle2.y / gameState.canvasHeight) * 100))}%`,
                            width: `${Math.max(1, (gameState.paddle2.width / gameState.canvasWidth) * 100)}%`,
                            height: `${Math.max(1, (gameState.paddle2.height / gameState.canvasHeight) * 100)}%`,
                            backgroundColor: isPlayerVsPlayer ? getPlayerVsNPCColor() : getPaddleAndBallColor()
                          }}
                        ></div>

                        {/* Ball with attack effect */}
                        <div
                          className={`absolute rounded-full  ${
                            isUnderAttack ? 'animate-pulse shadow-lg shadow-red-500' : ''
                          }`}
                          style={{
                            left: `${Math.max(0, Math.min(100, (gameState.ball.x / gameState.canvasWidth) * 100))}%`,
                            top: `${Math.max(0, Math.min(100, (gameState.ball.y / gameState.canvasHeight) * 100))}%`,
                            width: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasWidth) * 100)}%`,
                            height: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasHeight) * 100)}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: isUnderAttack ? '#ff4444' : (isPlayerVsPlayer ? getPlayerVsNPCColor() : getPaddleAndBallColor())
                          }}
                        ></div>
                      </>
                    ) : (
                      /* Loading state */
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-white text-xs opacity-60">Loading...</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Right side opponents - 20 tables in 7x3 grid (remaining 20 out of 41) */}
      {gameStarted && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
          <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
            {Array.from({ length: 20 }).map((_, i) => {
              const gameIndex = 21 + i; // 右側は22番目から41番目まで
              const otherPlayerGames = getOtherPlayerGames();
              const playerGameCount = otherPlayerGames.length;

              let gameToDisplay;
              let gameType;

              if (gameIndex < playerGameCount) {
                // プレイヤーゲームを配置
                gameToDisplay = otherPlayerGames[gameIndex];
                gameType = 'player';
              } else {
                // NPCゲームを配置（41 - プレイヤー数）
                const npcIndex = gameIndex - playerGameCount;
                const totalNpcNeeded = 41 - playerGameCount; // 中央除く41個からプレイヤー数を引く
                if (npcIndex < totalNpcNeeded && npcIndex < miniGames.length) {
                  gameToDisplay = miniGames[npcIndex];
                  gameType = 'npc';
                } else {
                  // NPCが不足している場合はプレースホルダー
                  gameToDisplay = null;
                  gameType = 'placeholder';
                }
              }

              // ⏰ 選択されたゲームタイプに基づいてキャンバスの古さをチェック（右側）
              const canvasId = gameType === 'player' ? `player-${gameToDisplay?.playerId}` : `npc-${gameIndex}`;
              const isStale = isCanvasStale(canvasId);

              if (isStale) {
                return null;
              }

              // 選択されたゲームの状態を取得（右側）
              const gameState = gameType === 'player' ? gameToDisplay?.gameState : gameToDisplay?.gameState?.gameState;

              // 右側ゲーム状態の安全性チェック
              if (!gameState || !gameState.paddle1 || !gameState.paddle2 || !gameState.ball ||
                  typeof gameState.paddle1.x === 'undefined' || typeof gameState.paddle2.x === 'undefined' ||
                  typeof gameState.ball.x === 'undefined') {
                // ゲーム状態が不完全な場合は何も表示しない
                return (null);
              }

              const isUnderAttack = false; // スピードブースト状態は別途管理が必要
              const isPlayerVsPlayer = gameType === 'player';

              return (
                <div
                  key={`right-${gameIndex}`}
                  className={`cursor-pointer transition-all duration-200 relative ${
                    selectedTarget === gameIndex ? 'scale-105' : 'hover:scale-102'
                  } ${isUnderAttack ? 'ring-2 ring-red-500 ring-opacity-75' : ''}`}
                  style={{ width: "12.8vmin", height: "12.8vmin" }}
                  onClick={() => handleTargetSelect(gameIndex)}
                >
                  {selectedTarget === gameIndex && (
                    <img
                      src="/images/icons/target_circle.svg"
                      alt="Target"
                      className="absolute inset-0 w-full h-full opacity-80 z-10"
                    />
                  )}

                  {/* 攻撃効果表示 */}
                  {isUnderAttack && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl z-20">
                      BOOST
                    </div>
                  )}

                  {/* NPC Manager-based mini pong game */}
                  <div className="w-full h-full border border-white relative overflow-hidden" style={{
                    backgroundColor: isUnderAttack ? "rgba(255,0,0,0.2)" : "rgba(255,255,255,0.15)"
                  }}>
                    {gameState && gameState.paddle1 && gameState.paddle2 && gameState.ball && gameState.canvasWidth && gameState.canvasHeight ? (
                      <>
                        {/* Player1 paddle */}
                        <div
                          className="absolute rounded"
                          style={{
                            left: `${Math.max(0, Math.min(100, (gameState.paddle1.x / gameState.canvasWidth) * 100))}%`,
                            top: `${Math.max(0, Math.min(100, (gameState.paddle1.y / gameState.canvasHeight) * 100))}%`,
                            width: `${Math.max(1, (gameState.paddle1.width / gameState.canvasWidth) * 100)}%`,
                            height: `${Math.max(1, (gameState.paddle1.height / gameState.canvasHeight) * 100)}%`,
                            backgroundColor: isPlayerVsPlayer ? getPlayerVsNPCColor() : getPaddleAndBallColor()
                          }}
                        ></div>

                        {/* Player2 paddle */}
                        <div
                          className="absolute rounded"
                          style={{
                            left: `${Math.max(0, Math.min(100, (gameState.paddle2.x / gameState.canvasWidth) * 100))}%`,
                            top: `${Math.max(0, Math.min(100, (gameState.paddle2.y / gameState.canvasHeight) * 100))}%`,
                            width: `${Math.max(1, (gameState.paddle2.width / gameState.canvasWidth) * 100)}%`,
                            height: `${Math.max(1, (gameState.paddle2.height / gameState.canvasHeight) * 100)}%`,
                            backgroundColor: isPlayerVsPlayer ? getPlayerVsNPCColor() : getPaddleAndBallColor()
                          }}
                        ></div>

                        {/* Ball with attack effect */}
                        <div
                          className={`absolute rounded-full  ${
                            isUnderAttack ? 'animate-pulse shadow-lg shadow-red-500' : ''
                          }`}
                          style={{
                            left: `${Math.max(0, Math.min(100, (gameState.ball.x / gameState.canvasWidth) * 100))}%`,
                            top: `${Math.max(0, Math.min(100, (gameState.ball.y / gameState.canvasHeight) * 100))}%`,
                            width: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasWidth) * 100)}%`,
                            height: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasHeight) * 100)}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: isUnderAttack ? '#ff4444' : (isPlayerVsPlayer ? getPlayerVsNPCColor() : getPaddleAndBallColor())
                          }}
                        ></div>
                      </>
                    ) : (
                      /* Loading state */
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-white text-xs opacity-60">Loading...</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Central game canvas (1 of 42 total canvases) */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {/* main play square - center canvas (your own game) */}
        <div className="relative" style={{ width: "90vmin", height: "90vmin" }}>
          <canvas ref={canvasRef} className="w-full h-full border border-white" />
        </div>

        {/* countdown screen */}
        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50">
            {countdown > 0 ? (
              <>
                <div className="text-8xl font-bold text-white animate-pulse mb-4">
                  {countdown}
                </div>
              </>
            ) : !miniGamesReady ? (
              <>
                <div className="text-4xl font-bold text-white mb-4">
                  Initializing Mini Games...
                </div>
                <div className="text-xl text-white opacity-80">
                  {miniGames.filter(g => g.active).length} / 42 games ready
                </div>
              </>
            ) : !miniGamesDataReady ? (
              <>
                <div className="text-4xl font-bold text-white mb-4">
                  Loading Game Data...
                </div>
                <div className="text-xl text-white opacity-80">
                  Fetching initial game states...
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Survivors count */}
      {gameStarted && (
        <div
          className="absolute z-30"
          style={{
            fontSize: "12.8vmin",
            lineHeight: 1,
            right: "1rem",
            bottom: "calc(50vh - 48vmin)",
            width: "12.8vmin",
            height: "12.8vmin",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <span className="text-white font-bold">{survivors}</span>
        </div>
      )}

      {/* Participant count during countdown */}
      {!gameStarted && countdown > 0 && (
        <div
          className="absolute z-30"
          style={{
            fontSize: "12.8vmin",
            lineHeight: 1,
            right: "1rem",
            bottom: "calc(50vh - 48vmin)",
            width: "12.8vmin",
            height: "12.8vmin",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <span className="text-white font-bold">{sfu.gameState.participantCount}</span>
        </div>
      )}

      {/* Survivors milestone alert */}
      {showSurvivorsAlert && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="text-8xl font-bold text-white animate-pulse text-center">
            {survivors}
          </div>
        </div>
      )}

      {/* Attack ray animation */}
      {attackAnimation && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {(() => {
            const targetPos = getTargetPosition(attackAnimation.targetIndex);
            const centerX = '50vw';
            const centerY = '50vh';

            // Calculate angle and distance for ray
            const deltaX = parseFloat(targetPos.x.replace(/[^0-9.-]/g, '')) - 50;
            const deltaY = parseFloat(targetPos.y.replace(/[^0-9.-]/g, '')) - 50;
            const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            return (
              <div
                className="absolute origin-left"
                style={{
                  left: centerX,
                  top: centerY,
                  width: `${distance}vmin`,
                  height: '4px',
                  background: 'linear-gradient(90deg, #ff6b6b, #ffd93d)',
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: '0 50%',
                  opacity: 0,
                  animation: 'ray-attack 1s ease-out forwards'
                }}
              />
            );
          })()}
        </div>
      )}

      {/* Global styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes ray-attack {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
          }
          .text-shadow-lg {
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          }
        `
      }} />
    </div>
  );
};

export default GamePong42;
