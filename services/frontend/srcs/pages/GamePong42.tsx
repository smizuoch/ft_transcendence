import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import { useNPCManager, NPCGameConfig, NPCGameResponse } from "@/utils/npcManagerService";

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
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);  // GamePong42特有の状態
  const [survivors, setSurvivors] = useState(42);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(Math.floor(Math.random() * 41));
  const [showSurvivorsAlert, setShowSurvivorsAlert] = useState(false);
  const [attackAnimation, setAttackAnimation] = useState<{ targetIndex: number; duration: number } | null>(null);
  const [miniGamesReady, setMiniGamesReady] = useState(false); // ミニゲーム初期化完了フラグ
  const [miniGamesDataReady, setMiniGamesDataReady] = useState(false); // ミニゲームデータ取得完了フラグ

  // ミニゲーム状態
  const [miniGames, setMiniGames] = useState<MiniGame[]>([]);

  // npc_managerサービスのhook
  const npcManager = useNPCManager();

  const { engineRef, initializeEngine, startGameLoop, stopGameLoop } = useGameEngine(canvasRef as React.RefObject<HTMLCanvasElement>, DEFAULT_CONFIG);
  const keysRef = useKeyboardControls();

  // ミニゲーム初期化（npc_managerサービス使用）
  useEffect(() => {
    if (miniGames.length > 0) return; // 既に初期化済みの場合はスキップ

    const initMiniGames = async () => {
      console.log('🎮 Starting miniGames initialization...');
      const games: MiniGame[] = [];
      const miniCanvasSize = { width: 100, height: 100 };      // 41個のNPC vs NPCゲームを作成
      for (let i = 0; i < 41; i++) {const gameConfig: NPCGameConfig = {          canvasWidth: 100, // ミニゲーム用キャンバス横幅
          canvasHeight: 100, // ミニゲーム用キャンバス縦幅          paddleWidth: 10, // パドル幅をより小さく
          paddleHeight: 1.5, // パドル高さをより小さく
          ballRadius: 2, // ボールサイズをより小さく          paddleSpeed: 6, // パドル速度を下げてより長いラリーを実現
          initialBallSpeed: 1.0, // 初期ボール速度を下げる
          maxBallSpeed: 2.5, // ボール最大速度を2.5に制限
          npc: {
            enabled: true,
            player: 1,
            mode: 'pid',
            difficulty: 'Easy',
          },          npc2: {
            enabled: true,
            player: 2,
            mode: 'pid',
            difficulty: 'Nightmare', // HardからNightmareに変更
          },
        };

        try {
          console.log(`🎯 Creating game ${i}...`);
          const result = await npcManager.createGame(gameConfig);
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

      // 初回ゲーム状態データを取得
      console.log('🔄 Fetching initial game state data...');
      try {
        const result = await npcManager.getAllActiveGames();
        if (result.success && result.data) {
          const activeGamesData = result.data;
          console.log('📥 Initial game state data received:', activeGamesData.length, 'games');

          const updatedGames = games.map(game => {
            if (!game.gameId) return game;
            const gameData = activeGamesData.find(data => data.gameId === game.gameId);
            return gameData ? { ...game, gameState: gameData } : game;
          });

          setMiniGames(updatedGames);
          setMiniGamesDataReady(true); // データ取得完了
          console.log('✅ Initial mini games data loaded successfully');
        } else {
          console.warn('❌ Failed to get initial active games:', result.error);
          // データ取得に失敗してもゲームは開始可能
          setMiniGamesDataReady(true);
        }
      } catch (error) {
        console.error('💥 Error fetching initial game state:', error);
        // エラーが発生してもゲームは開始可能
        setMiniGamesDataReady(true);
      }
    };

    // コンポーネントマウント時に即座に初期化開始
    initMiniGames();
  }, []); // 依存関係を空配列にして初回マウント時のみ実行

  // ミニゲーム更新ループ（npc_managerサービス使用）
  useEffect(() => {
    if (!miniGamesReady || gameOver) return; // ミニゲーム初期化完了後に開始

    const updateMiniGames = async () => {
      try {
        console.log('🔄 Updating mini games...');
        // 全てのアクティブなゲーム状態を一度に取得
        const result = await npcManager.getAllActiveGames();

        console.log('📥 getAllActiveGames result:', result);

        if (result.success && result.data) {
          const activeGamesData = result.data;
          console.log('🎮 Active games data:', activeGamesData);

          setMiniGames(prev => {
            return prev.map(game => {
              if (!game.gameId) return game;

              // 対応するゲーム状態を検索
              const gameData = activeGamesData.find(data => data.gameId === game.gameId);

              if (gameData) {
                // ゲーム終了チェック
                if (gameData.winner === 'player1') {
                  // Player1 (弱いNPC) が勝利 → ゲーム終了（稀なケース）
                  console.log(`Game ${game.gameId} ended: Player1 won`);
                  return { ...game, active: false, gameState: gameData };
                } else {
                  // ゲーム継続中またはPlayer2勝利
                  return { ...game, gameState: gameData };
                }
              } else {
                // ゲームが見つからない場合は非アクティブにする
                console.warn(`Game ${game.gameId} not found in active games`);
                return { ...game, active: false };
              }
            });
          });
        } else {
          console.warn('Failed to get active games:', result.error);
        }
      } catch (error) {
        console.error('Error updating mini games:', error);
      }
    };    const interval = setInterval(updateMiniGames, 16); // 60FPS（16ms間隔）でリアルタイム更新
    return () => clearInterval(interval);
  }, [miniGamesReady, gameOver, npcManager]);
  // 生存者数の更新
  useEffect(() => {
    const activeMiniGames = miniGames.filter(game => game.active).length;
    const centralCanvasActive = gameStarted && !gameOver ? 1 : 0; // 中央キャンバスがアクティブかどうか
    const totalSurvivors = activeMiniGames + centralCanvasActive;

    if (totalSurvivors !== survivors && gameStarted) {
      setSurvivors(totalSurvivors);
    }
  }, [miniGames, gameStarted, gameOver, survivors]);

  // 背景画像の取得
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
          await npcManager.applySpeedBoostToGame(targetGame.gameId);
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
  }, [selectedTarget, miniGames, npcManager]);

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

    setGameStarted(true);
    setGameOver(false);
    setWinner(null);
  }, [engineRef]); // getCurrentNPCの依存関係を削除

  // カウントダウン開始（ミニゲーム初期化完了後）
  useEffect(() => {
    if (!miniGamesReady || !miniGamesDataReady) return; // ミニゲーム初期化とデータ取得完了を待機

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleStartGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleStartGame, miniGamesReady, miniGamesDataReady]);

  // ゲームループの統一管理
  useEffect(() => {
    // カウントダウン中もゲームループを開始（プレイヤーのパドル操作のため）
    startGameLoop(handleScore, gameStarted, keysRef, getPaddleAndBallColor());

    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef, survivors]); // survivorsを依存関係に追加

  // Show alert when survivors count reaches milestone
  useEffect(() => {
    if (survivors === 32 || survivors === 21 || survivors === 5) {
      setShowSurvivorsAlert(true);
      setTimeout(() => setShowSurvivorsAlert(false), 3000);
    }
  }, [survivors]);

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

  useEffect(() => {
    if (gameOver && winner) {
      // ゲーム終了時にすべてのミニゲームを停止
      miniGames.forEach(async (game) => {
        if (game.gameId && game.active) {
          try {
            await npcManager.stopGame(game.gameId);
          } catch (error) {
            console.error(`Failed to stop game ${game.gameId}:`, error);
          }
        }
      });

      const t = setTimeout(() => navigate("GameResult"), 1200);
      return () => clearTimeout(t);
    }
  }, [gameOver, winner, navigate, miniGames, npcManager]);

  const handleTargetSelect = (index: number) => {
    if (miniGames[index]?.active) {
      setSelectedTarget(index);
    }
  };  // Calculate target position for ray animation
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
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>      {/* Left side opponents - 21 tables in 7x3 grid (21 out of 41) */}
      {gameStarted && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
          <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>            {Array.from({ length: Math.min(21, miniGames.length) }).map((_, i) => {
              const game = miniGames[i];
              if (!game?.active) return null;

              const gameState = game.gameState?.gameState; // NPCGameResponse.gameState
              const isUnderAttack = false; // スピードブースト状態は別途管理が必要

              // デバッグ: パドル位置情報をログに出力
              if (gameState && i === 0) { // 最初のゲームのみログ出力
                console.log(`🎯 Game ${i} paddle positions:`, {
                  paddle1: { x: gameState.paddle1.x, y: gameState.paddle1.y },
                  paddle2: { x: gameState.paddle2.x, y: gameState.paddle2.y },
                  ball: { x: gameState.ball.x, y: gameState.ball.y }
                });
              }

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
                    {gameState ? (
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
                            backgroundColor: isUnderAttack ? '#ff4444' : getPaddleAndBallColor()
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
      )}      {/* Right side opponents - 20 tables in 7x3 grid (remaining 20 out of 41) */}
      {gameStarted && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
          <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
            {Array.from({ length: Math.min(20, Math.max(0, miniGames.length - 21)) }).map((_, i) => {
              const gameIndex = 21 + i;
              const game = miniGames[gameIndex];
              if (!game?.active) return null;

              const gameState = game.gameState?.gameState; // NPCGameResponse.gameState
              const isUnderAttack = false; // スピードブースト状態は別途管理が必要

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
                    {gameState ? (
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
                            backgroundColor: isUnderAttack ? '#ff4444' : getPaddleAndBallColor()
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

      {/* central content */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {/* play square */}
        <div className="relative" style={{ width: "90vmin", height: "90vmin" }}>
          <canvas ref={canvasRef} className="w-full h-full border border-white" />
        </div>

        {/* countdown screen */}
        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {!miniGamesReady ? (
              <>
                <div className="text-4xl font-bold text-white mb-4">
                  Initializing Mini Games...
                </div>                <div className="text-xl text-white opacity-80">
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
            ) : countdown > 0 ? (
              <div className="text-8xl font-bold text-white animate-pulse">
                {countdown}
              </div>
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
