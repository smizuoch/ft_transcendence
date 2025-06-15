import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import { NPCGameResponse, NPCGameConfig } from "@/utils/npcManagerService";
import { useGamePong42SFU } from "@/utils/gamePong42SFU";

// GamePong42専用のカスタムConfig（中央キャンバスでpidNPCを有効にする）
const GAMEPONG42_CONFIG = {
  ...DEFAULT_CONFIG,
  npc: {
    ...DEFAULT_CONFIG.npc,
    enabled: true,
    player: 1 as const, // Player1をpidNPCに設定
    mode: 'pid' as const,
    difficulty: 'Hard' as const,
  },
};

interface GamePong42Props {
  navigate: (page: string) => void;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(Math.floor(Math.random() * 41));
  const [showSurvivorsAlert, setShowSurvivorsAlert] = useState(false);
  const [attackAnimation, setAttackAnimation] = useState<{ targetIndex: number; duration: number } | null>(null);
  const [miniGamesReady, setMiniGamesReady] = useState(false);

  // ミニゲーム状態
  const [miniGames, setMiniGames] = useState<MiniGame[]>([]);
  // WebRTC SFUのhook（純粋なデータ中継）
  const sfu = useGamePong42SFU();

  // SFUから取得する状態（Room Leaderが管理）
  const gameStarted = sfu.gameState.gameStarted;
  const countdown = sfu.gameState.countdown;
  const [survivors, setSurvivors] = useState(42); // 動的な生存者数
  const isWaitingForGame = !gameStarted && countdown > 0;

  // ゲーム開始済みフラグ（ローカル管理）
  const [gameInitialized, setGameInitialized] = useState(false);

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
    console.log('🎮 GamePong42 component mounted - resetting game state');
    sfu.resetGameState();

    // ローカル状態もリセット
    setGameOver(false);
    setWinner(null);
    setSelectedTarget(Math.floor(Math.random() * 41));
    setShowSurvivorsAlert(false);
    setAttackAnimation(null);
    setMiniGamesReady(false);
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
        console.log('🎮 Canvas found with dimensions, initializing engine...');
        initializeEngine();
        canvasInitializedRef.current = true;
        return;
      }

      initRetryCountRef.current++;
      if (initRetryCountRef.current < MAX_INIT_RETRIES) {
        console.log(`⏳ Canvas not ready yet, retrying (${initRetryCountRef.current}/${MAX_INIT_RETRIES}) in 100ms...`);
        setTimeout(initializeCanvasWhenReady, 100);
      } else {
        console.log('ℹ️ Canvas initialization will be handled when game starts');
        // 強制初期化は削除 - ゲーム開始時に確実に初期化される
      }
    };

    // 最初の試行を少し遅延
    const timeoutId = setTimeout(initializeCanvasWhenReady, 200);
    return () => clearTimeout(timeoutId);
  }, [initializeEngine]);

  // SFUのローカルゲーム状態を監視してUIを更新
  useEffect(() => {
    const { gameState } = sfu;

    // カウントダウン状態の反映
    if (gameState.countdown >= 0 && !gameState.gameStarted) {
      console.log(`⏰ Countdown: ${gameState.countdown}`);
    }

    // ゲーム開始状態の反映
    if (gameState.gameStarted && !gameInitialized) {
      console.log('🎮 Game started locally - initializing mini games');

      // ゲーム開始時にCanvas初期化を確実に実行
      if (canvasRef.current && !canvasInitializedRef.current) {
        console.log('🎮 Initializing engine at game start...');
        initializeEngine();
        canvasInitializedRef.current = true;
        console.log('✅ Canvas successfully initialized at game start');
      }

      // NPCの数を計算（42 - 参加者数）
      const npcCount = Math.max(0, 42 - gameState.participantCount);
      console.log(`🎮 Initializing ${npcCount} mini games for NPCs`);

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

      console.log('👑 Room Leader confirmed, auto-starting countdown with', gameState.participantCount, 'participants');
      countdownStartedRef.current = true; // フラグを設定

      // 少し遅延してからカウントダウン開始（他のプレイヤーの参加を待つ）
      const timeoutId = setTimeout(() => {
        if (gameState.isRoomLeader && !gameState.gameStarted) { // 再確認
          console.log('🏆 Starting Room Leader countdown...');
          sfu.startRoomLeaderCountdown();
        }
      }, 1000); // 1秒遅延（サーバー応答を待つ）

      return () => clearTimeout(timeoutId);
    }
  }, [sfu.gameState.isRoomLeader, sfu.gameState.participantCount, sfu]);

  // 他のプレイヤーからの入力を受信
  useEffect(() => {
    sfu.receivedData.forEach(data => {
      if (data.type === 'playerInput') {
        console.log('📨 Received player input from', data.playerId, ':', data.payload);
        // 他のプレイヤーの入力を処理（必要に応じて実装）
      } else if (data.type === 'gameState') {
        console.log('📨 Received game state from', data.playerId, ':', data.payload);
        // 他のプレイヤーのゲーム状態を処理（必要に応じて実装）
      }
    });
  }, [sfu.receivedData]);

  // 他のプレイヤーからの入力を使ってミニゲームを更新
  useEffect(() => {
    sfu.receivedData.forEach(data => {
      if (data.type === 'gameState') {
        console.log('📨 Received game state from other player:', data.playerId);

        // 他のプレイヤーのゲーム状態をミニゲームに反映
        const playerIndex = Math.floor(Math.random() * miniGames.length);

        setMiniGames(prev => {
          const updated = [...prev];
          if (updated[playerIndex]) {
            updated[playerIndex] = {
              ...updated[playerIndex],
              gameState: {
                gameId: `player-${data.playerId}`,
                gameState: data.payload,
                isRunning: true,
                score: { player1: 0, player2: 0 }
              },
              active: true
            };
          }
          return updated;
        });
      }
    });
  }, [sfu.receivedData, miniGames.length]);

  // NPCデータの監視・処理（SFU経由でNPCデータを受信）
  useEffect(() => {
    sfu.receivedData.forEach(data => {
      if (data.type === 'gameState' && data.playerId === 'npc-manager' && data.payload.npcStates) {
        // 生存者数の更新（アクティブなNPCの数 + 参加プレイヤー数）
        const activeNPCCount = data.payload.npcStates.filter((npc: any) => npc.active !== false).length;
        const totalSurvivors = activeNPCCount + sfu.gameState.participantCount;
        setSurvivors(totalSurvivors);
        console.log('� Survivors updated:', totalSurvivors, `(${activeNPCCount} NPCs + ${sfu.gameState.participantCount} players)`);

        console.log('🤖 NPC states updated:', data.payload.npcStates.length, 'total NPCs,', activeNPCCount, 'active');
        if (data.payload.npcStates.length > 0) {
          console.log('� First NPC state sample:', data.payload.npcStates[0]);
        }

        // NPCの状態をミニゲームに反映
        setMiniGames(prev => {
          console.log('🎮 Current miniGames length:', prev.length, 'NPCs to process:', data.payload.npcStates.length);

          // miniGames配列が空の場合、動的にプレースホルダーを作成
          if (prev.length === 0 && data.payload.npcStates.length > 0) {
            console.log('🔧 Creating dynamic placeholder miniGames for NPC data');
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
            console.log(`✅ Created ${dynamicGames.length} dynamic placeholder miniGames`);
          }

          if (prev.length === 0) {
            console.warn('⚠️ miniGames array is still empty after dynamic creation attempt');
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

          console.log('🎮 Updated', updatedCount, 'mini games with NPC data');
          return updated;
        });
      }
    });
  }, [sfu.receivedData]);

  // ミニゲーム更新ループ（WebRTC SFU経由でNPCManagerから更新を受信）
  useEffect(() => {
    if (!miniGamesReady || gameOver || !gameStarted) return;

    // WebRTC SFU経由でNPCの状態が更新される場合の処理は
    // 上記のnpcStatesの監視で処理される
    console.log('ℹ️ Mini games update now handled via WebRTC SFU');
  }, [miniGamesReady, gameOver, gameStarted]);

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
    if (!gameStarted || !sfu.connected || !engineRef.current) return;

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
    console.log(`🎮 initMiniGames called with npcCount: ${npcCount}, current miniGames.length: ${miniGames.length}`);
    console.log(`🔍 Room Leader status: ${sfu.gameState.isRoomLeader}, connected: ${sfu.connected}`);

    // Room Leaderでない場合はNPCデータ受信用のプレースホルダーを作成
    if (!sfu.gameState.isRoomLeader) {
      console.log('⚠️ Not room leader, creating placeholder miniGames for NPC data display');
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
      console.log(`✅ Created ${placeholderGames.length} placeholder miniGames for NPC data display`);
      return;
    }

    if (miniGames.length > 0) {
      console.log('🔄 miniGames already initialized, skipping');
      return; // 既に初期化済みの場合はスキップ
    }

    console.log(`🎮 Starting miniGames initialization with ${npcCount} NPCs...`);
    const games: MiniGame[] = [];
    const miniCanvasSize = { width: 100, height: 100 };

    // NPCが0の場合（42人満員）はミニゲームを作成しない
    if (npcCount === 0) {
      console.log('⚠️ 42 participants detected, no mini-games needed');
      setMiniGamesReady(true);
      return;
    }

    // NPC数分のNPC vs NPCゲームを作成
    for (let i = 0; i < npcCount; i++) {
      const gameConfig: NPCGameConfig = {
        canvasWidth: 100, // ミニゲーム用キャンバス横幅
        canvasHeight: 100, // ミニゲーム用キャンバス縦幅
        paddleWidth: 10, // パドル幅をより小さく
        paddleHeight: 1.5, // パドル高さをより小さく
        ballRadius: 2, // ボールサイズをより小さく
        paddleSpeed: 6, // パドル速度を下げてより長いラリーを実現
        initialBallSpeed: 1.0, // 初期ボール速度を下げる
        maxBallSpeed: 2.5, // ボール最大速度を2.5に制限
        npc: {
          enabled: true,
          player: 1,
          mode: 'pid',
          difficulty: 'Easy',
        },
        npc2: {
          enabled: true,
          player: 2,
          mode: 'pid',
          difficulty: 'Nightmare', // HardからNightmareに変更
        },
      };

      try {
        console.log(`🎯 Creating game ${i}...`);
        console.log(`🔍 SFU state - connected: ${sfu.connected}, isRoomLeader: ${sfu.gameState.isRoomLeader}, roomNumber: ${sfu.roomNumber}`);
        console.log(`🔍 sfu.createNPCGame exists:`, typeof sfu.createNPCGame);

        if (!sfu.createNPCGame) {
          throw new Error('sfu.createNPCGame is not available');
        }

        const result = await sfu.createNPCGame(gameConfig) as { success: boolean; gameId?: string; error?: string };
        console.log(`🔍 createNPCGame result:`, result);

        if (result.success && result.gameId) {
          console.log(`✅ Game ${i} created with ID: ${result.gameId}`);
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

    console.log(`🏁 MiniGames initialization complete. Created ${games.filter(g => g.active).length} active games.`);
    setMiniGames(games);
    setMiniGamesReady(true); // ミニゲーム初期化完了
  }, [miniGames.length, sfu.createNPCGame, sfu.connected, sfu.gameState.isRoomLeader]);

  // SFUサーバーに接続
  useEffect(() => {
    console.log('🔗 Starting SFU connection process...');

    try {
      sfu.connect();
      console.log('🔗 SFU connect function called successfully');
    } catch (error) {
      console.error('❌ Error calling SFU connect:', error);
    }

    // クリーンアップ
    return () => {
      console.log('🔌 Cleaning up SFU connection...');
      sfu.disconnect();
    };
  }, []); // 初回のみ実行

  // 接続状態をログ出力
  useEffect(() => {
    console.log('🔗 SFU connected state changed:', sfu.connected);
  }, [sfu.connected]);

  // 接続完了後に部屋に参加
  useEffect(() => {
    if (sfu.connected) {
      console.log('✅ Connected to SFU server, preparing to join GamePong42 room...');

      const playerInfo = playerInfoRef.current; // 固定のプレイヤー情報を使用
      const roomNumber = 'gamepong42-room-1'; // 固定の部屋番号
      console.log('🏠 Attempting to join room:', roomNumber, 'with player info:', playerInfo);

      try {
        sfu.joinRoom(roomNumber, playerInfo);
        console.log('🏠 Joined room:', roomNumber);
      } catch (error) {
        console.error('❌ Error joining room:', error);
      }
    } else {
      console.log('⏳ Waiting for SFU connection to be established...');
    }
  }, [sfu.connected]);

  // ゲーム状態の監視
  useEffect(() => {
    console.log('🎮 Game state updated:', sfu.gameState);

    // ゲーム開始状態の反映
    if (sfu.gameState.gameStarted && !gameStarted) {
      console.log('🎮 Game started locally');

      // NPCを上側（Player1）のみに設定
      if (engineRef.current) {
        engineRef.current.updateNPCConfig({
          player: 1 as 1 | 2, // Player 1 (上)がNPC
          mode: 'pid' as any,
          enabled: true,
          difficulty: 'Normal' as any,
        });
      }

      // NPCの数を計算（42 - 参加者数）
      const npcCount = Math.max(0, 42 - sfu.gameState.participantCount);
      if (npcCount > 0) {
        initMiniGames(npcCount);
      } else {
        setMiniGamesReady(true); // 42人満員の場合はNPCなし
      }
    }
  }, [sfu.gameState, gameStarted, engineRef]);

  // 受信データの監視
  useEffect(() => {
    if (sfu.receivedData.length > 0) {
      console.log('📨 Received data:', sfu.receivedData);
    }
  }, [sfu.receivedData]);

  // ゲームループの統一管理（Canvas要素とエンジンが確実に初期化されてから開始）
  useEffect(() => {
    if (!gameStarted || !canvasRef.current || !engineRef.current) {
      console.log('⏳ Waiting for game conditions: gameStarted =', gameStarted, ', canvas =', !!canvasRef.current, ', engine =', !!engineRef.current);
      return;
    }

    console.log('🎮 Starting game loop with all conditions met');

    // パドルとボールの色を取得
    const getPaddleAndBallColor = () => {
      if (survivors < 33) return '#ffffff';
      return '#212121';
    };

    const handleScore = (scorer: 'player1' | 'player2') => {
      if (scorer === 'player1') { // NPCが勝利した場合
        setGameOver(true);
        setWinner(1);
      }
    };

    startGameLoop(handleScore, gameStarted, keysRef, getPaddleAndBallColor());
    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, keysRef, survivors, canvasRef.current, engineRef.current]);

  // ゲームエンジン初期化（コンポーネントマウント時とリサイズ時）
  useEffect(() => {
    // canvasが利用可能になったら即座に初期化
    if (canvasRef.current) {
      console.log('🎮 Canvas detected, initializing engine...');
      initializeEngine();
    }

    const handleResize = () => {
      if (canvasRef.current) {
        console.log('🔄 Resizing and re-initializing engine...');
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
      console.log('🎮 Canvas available, ensuring engine is initialized...');
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

  const handleScore = useCallback((scorer: 'player1' | 'player2') => {
    // GamePong42では得点システムではなく生存者システム
    if (scorer === 'player1') { // NPCが勝利した場合（Player1 = NPC）
      setGameOver(true);
      setWinner(1);
    }
    // プレイヤーが勝利した場合（Player2）は攻撃フェーズに移行
    if (scorer === 'player2') {
      // プレイヤーがNPCに勝利 - 自動攻撃実行
      executeAutoAttack();
    }
  }, [selectedTarget, survivors]);

  const executeAutoAttack = useCallback(async () => {
    if (selectedTarget !== null) {
      // Show attack animation from center to target opponent
      setAttackAnimation({ targetIndex: selectedTarget, duration: 1000 });
      setTimeout(() => setAttackAnimation(null), 1000);

      // 選択されたミニゲームにスピードブースト攻撃を適用
      const targetGame = miniGames[selectedTarget];
      if (targetGame?.active && targetGame.gameId) {
        try {
          await sfu.applySpeedBoostToNPCGame(targetGame.gameId);
        } catch (error) {
          console.error('Failed to apply speed boost:', error);
        }
      }

      // 新しいターゲットを選択（アクティブなゲームのみ）
      setTimeout(() => {
        const activeGames = miniGames.filter((game, index) => game.active && index !== selectedTarget);
        if (activeGames.length > 0) {
          const randomActiveGame = activeGames[Math.floor(Math.random() * activeGames.length)];
          const newTargetIndex = miniGames.findIndex(game => game.id === randomActiveGame.id);
          setSelectedTarget(newTargetIndex);
        }
      }, 1000);
    }
  }, [selectedTarget, miniGames, sfu]);

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
        startGameLoop(handleScore, gameStarted, keysRef, getPaddleAndBallColor());
      }, 100);

      return () => {
        clearTimeout(timer);
        stopGameLoop();
      };
    }
  }, [gameStarted, initializeEngine, startGameLoop, stopGameLoop, handleScore, keysRef, survivors]);

  // キャンバスマウント時の初期化
  useEffect(() => {
    if (canvasRef.current) {
      initializeEngine();
    }
  }, [canvasRef.current, initializeEngine]);

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
      if (canvasRef.current) {
        initializeEngine();
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

  useEffect(() => {
    if (gameOver && winner) {
      // ゲーム終了時にすべてのミニゲームを停止
      miniGames.forEach(async (game) => {
        if (game.gameId && game.active) {
          try {
            await sfu.stopNPCGame(game.gameId);
          } catch (error) {
            console.error(`Failed to stop game ${game.gameId}:`, error);
          }
        }
      });

      const t = setTimeout(() => navigate("GameResult"), 1200);
      return () => clearTimeout(t);
    }
  }, [gameOver, winner, navigate, miniGames, sfu]);

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

      {/* Waiting screen */}
      {isWaitingForGame && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-6xl font-bold mb-8">GamePong42</h1>
            <div className="text-3xl mb-4">Waiting for players...</div>
            <div className="text-2xl mb-4">
              Players: {sfu.gameState.participantCount} / 42
            </div>
            {countdown > 0 && (
              <div className="text-4xl font-bold animate-pulse">
                Game starts in: {countdown}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game UI */}
      {gameStarted && (
        <>
          {/* Left side opponents - 21 tables in 7x3 grid (21 out of 41) */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
            <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
              {Array.from({ length: 21 }).map((_, i) => {
                const game = miniGames[i];
                const hasNPCGame = game?.active && game.gameState;
                const hasOtherPlayers = sfu.gameState.participantCount > 1;

                // NPC vs NPC ゲーム、または他のプレイヤーとの対戦を表示
                // ただし、NPCゲームが終了している（active: false）場合は非表示
                const shouldShowCanvas = (hasNPCGame && game.active) || (hasOtherPlayers && i < (41 - miniGames.length) && !hasNPCGame);

                if (!shouldShowCanvas) return null;

                const gameState = game?.gameState?.gameState; // NPCGameResponse.gameState
                const isUnderAttack = false; // スピードブースト状態は別途管理が必要
                const isPlayerVsPlayer = !hasNPCGame && hasOtherPlayers;

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
                      {gameState && gameState.paddle1 && gameState.paddle2 && gameState.ball ? (
                        <>
                          {/* Player1 paddle */}
                          <div
                            className="absolute rounded"
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.paddle1.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.paddle1.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.paddle1.width / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.paddle1.height / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: getPaddleAndBallColor()
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
                              backgroundColor: getPaddleAndBallColor()
                            }}
                          ></div>

                          {/* Ball */}
                          <div
                            className={`absolute rounded-full ${
                              isUnderAttack ? 'animate-pulse shadow-lg shadow-red-500' : ''
                            }`}
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.ball.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.ball.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: isUnderAttack ? '#ff0000' : getPaddleAndBallColor()
                            }}
                          ></div>
                        </>
                      ) : (
                        /* Placeholder for player vs player battles */
                        <div className="w-full h-full flex items-center justify-center text-white text-xs">
                          {isPlayerVsPlayer ? 'P vs P' : 'Loading...'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Central canvas */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <canvas
              ref={canvasRef}
              className="border border-white bg-black bg-opacity-30"
              style={{
                width: '60vmin',
                height: '40vmin',
                maxWidth: '80vw',
                maxHeight: '60vh',
              }}
            />
          </div>

          {/* Right side opponents - 20 tables in 7x3 grid (positions 21-40 out of 41) */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
            <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
              {Array.from({ length: 20 }).map((_, i) => {
                const gameIndex = i + 21; // Right side starts from index 21
                const game = miniGames[gameIndex];
                const hasNPCGame = game?.active && game.gameState;
                const hasOtherPlayers = sfu.gameState.participantCount > 1;

                const shouldShowCanvas = (hasNPCGame && game.active) || (hasOtherPlayers && gameIndex < (41 - miniGames.length) && !hasNPCGame);

                if (!shouldShowCanvas) return null;

                const gameState = game?.gameState?.gameState;
                const isUnderAttack = false;
                const isPlayerVsPlayer = !hasNPCGame && hasOtherPlayers;

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

                    {isUnderAttack && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl z-20">
                        BOOST
                      </div>
                    )}

                    <div className="w-full h-full border border-white relative overflow-hidden" style={{
                      backgroundColor: isUnderAttack ? "rgba(255,0,0,0.2)" : "rgba(255,255,255,0.15)"
                    }}>
                      {gameState && gameState.paddle1 && gameState.paddle2 && gameState.ball ? (
                        <>
                          <div
                            className="absolute rounded"
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.paddle1.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.paddle1.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.paddle1.width / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.paddle1.height / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: getPaddleAndBallColor()
                            }}
                          ></div>

                          <div
                            className="absolute rounded"
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.paddle2.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.paddle2.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.paddle2.width / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.paddle2.height / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: getPaddleAndBallColor()
                            }}
                          ></div>

                          <div
                            className={`absolute rounded-full ${
                              isUnderAttack ? 'animate-pulse shadow-lg shadow-red-500' : ''
                            }`}
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.ball.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.ball.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: isUnderAttack ? '#ff0000' : getPaddleAndBallColor()
                            }}
                          ></div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xs">
                          {isPlayerVsPlayer ? 'P vs P' : 'Loading...'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* UI Elements */}
          <div className="absolute top-4 left-4 text-white z-30">
            <div className="text-2xl font-bold">Survivors: {survivors}</div>
            <div className="text-sm">Players: {sfu.gameState.participantCount}</div>
          </div>

          {/* Attack Animation Ray */}
          {attackAnimation && (
            <div
              className="absolute pointer-events-none z-40"
              style={{
                left: '50%',
                top: '50%',
                width: '2px',
                height: '2px',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="absolute bg-red-500 shadow-lg shadow-red-500 animate-pulse"
                style={{
                  width: '4px',
                  height: '200px',
                  transformOrigin: 'center bottom',
                  transform: `rotate(${Math.atan2(
                    parseFloat(getTargetPosition(attackAnimation.targetIndex).y.replace('vh', '')) - 50,
                    parseFloat(getTargetPosition(attackAnimation.targetIndex).x.replace(/v[mw]/, '')) - 50
                  )}rad)`,
                  transition: `opacity ${attackAnimation.duration}ms ease-out`,
                }}
              />
            </div>
          )}

          {/* Survivors Alert */}
          {showSurvivorsAlert && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 text-center">
              <div className="bg-black bg-opacity-75 text-white px-8 py-4 rounded-lg text-3xl font-bold animate-pulse">
                {survivors} Survivors Remaining!
              </div>
            </div>
          )}

          {/* Game Over Screen */}
          {gameOver && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="text-center text-white">
                <h1 className="text-6xl font-bold mb-4">
                  {winner === 1 ? 'NPC Wins!' : 'You Win!'}
                </h1>
                <p className="text-2xl">Redirecting to results...</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GamePong42;
