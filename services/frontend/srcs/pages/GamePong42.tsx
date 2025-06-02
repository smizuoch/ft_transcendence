import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG, GameEngine } from "@/utils/gameEngine";

interface GamePong42Props {
  navigate: (page: string) => void;
}

// ミニゲーム用のインターフェイス
interface MiniGame {
  id: number;
  active: boolean;
  engine: GameEngine;
  canvasSize: { width: number; height: number };
}

const GamePong42: React.FC<GamePong42Props> = ({ navigate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);

  // GamePong42特有の状態
  const [survivors, setSurvivors] = useState(42);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(Math.floor(Math.random() * 41));
  const [showSurvivorsAlert, setShowSurvivorsAlert] = useState(false);
  const [attackAnimation, setAttackAnimation] = useState<{ targetIndex: number; duration: number } | null>(null);

  // ミニゲーム状態
  const [miniGames, setMiniGames] = useState<MiniGame[]>([]);

  const { engineRef, initializeEngine, startGameLoop, stopGameLoop } = useGameEngine(canvasRef, DEFAULT_CONFIG);
  const keysRef = useKeyboardControls();

  // ミニゲーム初期化
  useEffect(() => {
    const initMiniGames = () => {
      const games: MiniGame[] = [];
      const miniCanvasSize = { width: 100, height: 100 }; // ミニキャンバスのサイズ

      for (let i = 0; i < 42; i++) {
        // 各ミニゲーム用のGameEngineインスタンスを作成
        const miniEngine = new GameEngine(miniCanvasSize.width, miniCanvasSize.height, {
          ...DEFAULT_CONFIG,
          paddleWidth: 12, // ミニゲーム用に調整
          paddleHeight: 2,
          ballRadius: 1,
          paddleSpeed: 6, // 4 → 6に上昇
          initialBallSpeed: 1.5, // 3 → 1.5に削減（さらにゆっくり）
        });

        // 上側を弱いPID NPCに設定（Player1を弱く）
        miniEngine.updateNPCConfig({
          player: 1 as 1 | 2, // Player1（上側）
          mode: 'pid' as any,
          enabled: true,
          difficulty: 'Easy' as any, // Normal → Easyに変更（さらに弱く）
        });

        // 下側を最強のPID NPCに設定（Player2を最強にして長生きさせる）
        miniEngine.updateNPCConfig2({
          mode: 'pid' as any,
          enabled: true,
          difficulty: 'Nightmare' as any, // Hard → Nightmareに変更（最強）
        });

        games.push({
          id: i,
          active: true,
          engine: miniEngine,
          canvasSize: miniCanvasSize,
        });
      }
      setMiniGames(games);
    };

    if (gameStarted) {
      initMiniGames();
    }
  }, [gameStarted]);

  // ミニゲーム更新ループ
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const interval = setInterval(() => {
      setMiniGames(prev => prev.map(game => {
        if (!game.active) return game;

        // GameEngineの更新を100回実行（大幅に高速化）
        let result: 'none' | 'player1' | 'player2' = 'none';
        for (let i = 0; i < 100; i++) {
          result = game.engine.update();
          if (result !== 'none') break; // 失点があったら即座に終了
        }

        // 失点チェック
        if (result === 'player2') {
          // 下側NPCの失点 → ゲーム終了
          return { ...game, active: false };
        }
        // player1の失点の場合は続行（ボールはエンジン内でリセット済み）

        return game;
      }));
    }, 1000); // 150ms → 1000msに変更（約6.7FPS → 1FPS）

    return () => clearInterval(interval);
  }, [gameStarted, gameOver]);

  // 生存者数の更新
  useEffect(() => {
    const activeMiniGames = miniGames.filter(game => game.active).length;
    if (activeMiniGames !== survivors && gameStarted) {
      setSurvivors(activeMiniGames);
    }
  }, [miniGames, gameStarted, survivors]);

  // 背景画像の取得
  const getBackgroundImage = () => {
    if (survivors >= 33) return '/images/background/noon.png';
    if (survivors >= 22) return '/images/background/evening.png';
    if (survivors >= 6) return '/images/background/late_night.png';
    return '/images/background/daybreak.png';
  };

  // パドルとボールの色を取得
  const getPaddleAndBallColor = () => {
    return survivors >= 6 && survivors < 22 ? '#ffffff' : '#212121';
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

  const executeAutoAttack = useCallback(() => {
    if (selectedTarget !== null) {
      // Show attack animation from center to target opponent
      setAttackAnimation({ targetIndex: selectedTarget, duration: 1000 });
      setTimeout(() => setAttackAnimation(null), 1000);

      // 選択されたミニゲームにボール加速攻撃を適用（得点まで継続）
      const targetGame = miniGames[selectedTarget];
      if (targetGame?.active) {
        targetGame.engine.applySpeedAttack(3.0); // 3倍速で得点まで継続
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
  }, [selectedTarget, miniGames]);

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

  // 5秒後の自動ゲーム開始
  useEffect(() => {
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
  }, [handleStartGame]);

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
      const t = setTimeout(() => navigate("GameResult"), 1200);
      return () => clearTimeout(t);
    }
  }, [gameOver, winner, navigate]);

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

      {/* Left side opponents - 21 tables in 7x3 grid */}
      {gameStarted && (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
          <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
            {Array.from({ length: Math.min(21, miniGames.length) }).map((_, i) => {
              const game = miniGames[i];
              if (!game?.active) return null;

              const gameState = game.engine.getState();
              const attackEffect = game.engine.getAttackEffect();

              return (
                <div
                  key={`left-${i}`}
                  className={`cursor-pointer transition-all duration-200 relative ${
                    selectedTarget === i ? 'scale-105' : 'hover:scale-102'
                  } ${attackEffect.isActive ? 'ring-2 ring-red-500 ring-opacity-75' : ''}`}
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
                  {attackEffect.isActive && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl z-20">
                      BOOST
                    </div>
                  )}

                  {/* GameEngine-based mini pong game */}
                  <div className="w-full h-full border border-white relative overflow-hidden" style={{
                    backgroundColor: attackEffect.isActive ? "rgba(255,0,0,0.2)" : "rgba(255,255,255,0.15)"
                  }}>
                    {/* Player1 paddle */}
                    <div
                      className="absolute rounded transition-all duration-75"
                      style={{
                        left: `${Math.max(0, Math.min(100, (gameState.paddle1.x / game.canvasSize.width) * 100))}%`,
                        top: `${Math.max(0, Math.min(100, (gameState.paddle1.y / game.canvasSize.height) * 100))}%`,
                        width: `${Math.max(1, (gameState.paddle1.width / game.canvasSize.width) * 100)}%`,
                        height: `${Math.max(1, (gameState.paddle1.height / game.canvasSize.height) * 100)}%`,
                        backgroundColor: getPaddleAndBallColor()
                      }}
                    ></div>

                    {/* Player2 paddle */}
                    <div
                      className="absolute rounded transition-all duration-75"
                      style={{
                        left: `${Math.max(0, Math.min(100, (gameState.paddle2.x / game.canvasSize.width) * 100))}%`,
                        top: `${Math.max(0, Math.min(100, (gameState.paddle2.y / game.canvasSize.height) * 100))}%`,
                        width: `${Math.max(1, (gameState.paddle2.width / game.canvasSize.width) * 100)}%`,
                        height: `${Math.max(1, (gameState.paddle2.height / game.canvasSize.height) * 100)}%`,
                        backgroundColor: getPaddleAndBallColor()
                      }}
                    ></div>

                    {/* Ball with attack effect */}
                    <div
                      className={`absolute rounded-full transition-all duration-50 ${
                        attackEffect.isActive ? 'animate-pulse shadow-lg shadow-red-500' : ''
                      }`}
                      style={{
                        left: `${Math.max(0, Math.min(100, (gameState.ball.x / game.canvasSize.width) * 100))}%`,
                        top: `${Math.max(0, Math.min(100, (gameState.ball.y / game.canvasSize.height) * 100))}%`,
                        width: `${Math.max(1, (gameState.ball.radius * 2 / game.canvasSize.width) * 100)}%`,
                        height: `${Math.max(1, (gameState.ball.radius * 2 / game.canvasSize.height) * 100)}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: attackEffect.isActive ? '#ff4444' : getPaddleAndBallColor()
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Right side opponents - 21 tables in 7x3 grid */}
      {gameStarted && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
          <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
            {Array.from({ length: Math.min(21, Math.max(0, miniGames.length - 21)) }).map((_, i) => {
              const gameIndex = 21 + i;
              const game = miniGames[gameIndex];
              if (!game?.active) return null;

              const gameState = game.engine.getState();
              const attackEffect = game.engine.getAttackEffect();

              return (
                <div
                  key={`right-${gameIndex}`}
                  className={`cursor-pointer transition-all duration-200 relative ${
                    selectedTarget === gameIndex ? 'scale-105' : 'hover:scale-102'
                  } ${attackEffect.isActive ? 'ring-2 ring-red-500 ring-opacity-75' : ''}`}
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
                  {attackEffect.isActive && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl z-20">
                      BOOST
                    </div>
                  )}

                  {/* GameEngine-based mini pong game */}
                  <div className="w-full h-full border border-white relative overflow-hidden" style={{
                    backgroundColor: attackEffect.isActive ? "rgba(255,0,0,0.2)" : "rgba(255,255,255,0.15)"
                  }}>
                    {/* Player1 paddle */}
                    <div
                      className="absolute rounded transition-all duration-75"
                      style={{
                        left: `${Math.max(0, Math.min(100, (gameState.paddle1.x / game.canvasSize.width) * 100))}%`,
                        top: `${Math.max(0, Math.min(100, (gameState.paddle1.y / game.canvasSize.height) * 100))}%`,
                        width: `${Math.max(1, (gameState.paddle1.width / game.canvasSize.width) * 100)}%`,
                        height: `${Math.max(1, (gameState.paddle1.height / game.canvasSize.height) * 100)}%`,
                        backgroundColor: getPaddleAndBallColor()
                      }}
                    ></div>

                    {/* Player2 paddle */}
                    <div
                      className="absolute rounded transition-all duration-75"
                      style={{
                        left: `${Math.max(0, Math.min(100, (gameState.paddle2.x / game.canvasSize.width) * 100))}%`,
                        top: `${Math.max(0, Math.min(100, (gameState.paddle2.y / game.canvasSize.height) * 100))}%`,
                        width: `${Math.max(1, (gameState.paddle2.width / game.canvasSize.width) * 100)}%`,
                        height: `${Math.max(1, (gameState.paddle2.height / game.canvasSize.height) * 100)}%`,
                        backgroundColor: getPaddleAndBallColor()
                      }}
                    ></div>

                    {/* Ball with attack effect */}
                    <div
                      className={`absolute rounded-full transition-all duration-50 ${
                        attackEffect.isActive ? 'animate-pulse shadow-lg shadow-red-500' : ''
                      }`}
                      style={{
                        left: `${Math.max(0, Math.min(100, (gameState.ball.x / game.canvasSize.width) * 100))}%`,
                        top: `${Math.max(0, Math.min(100, (gameState.ball.y / game.canvasSize.height) * 100))}%`,
                        width: `${Math.max(1, (gameState.ball.radius * 2 / game.canvasSize.width) * 100)}%`,
                        height: `${Math.max(1, (gameState.ball.radius * 2 / game.canvasSize.height) * 100)}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: attackEffect.isActive ? '#ff4444' : getPaddleAndBallColor()
                      }}
                    ></div>
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
        {!gameStarted && countdown > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-8xl font-bold text-white animate-pulse">
              {countdown}
            </div>
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
