import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";

interface GamePong42Props {
  navigate: (page: string) => void;
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

  const { engineRef, initializeEngine, startGameLoop, stopGameLoop } = useGameEngine(canvasRef, DEFAULT_CONFIG);
  const keysRef = useKeyboardControls();

  // 背景画像の取得
  const getBackgroundImage = () => {
    if (survivors >= 33) return '/images/background/noon.png';
    if (survivors >= 22) return '/images/background/evening.png';
    if (survivors >= 6) return '/images/background/late_night.png';
    return '/images/background/daybreak.png';
  };

  // NPCタイプの取得
  const getCurrentNPC = () => {
    if (survivors >= 22) return 'technician';
    return 'pid';
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

      // Simulate game progression
      if (Math.random() > 0.7) { // 30% chance to eliminate target
        const newSurvivors = survivors - 1;
        setSurvivors(newSurvivors);

        if (newSurvivors <= 1) {
          setGameOver(true);
          setWinner(2); // プレイヤー勝利
          return;
        }

        // Select new random target
        const availableTargets = Array.from({ length: newSurvivors - 1 }, (_, i) => i);
        setSelectedTarget(availableTargets[Math.floor(Math.random() * availableTargets.length)]);
      }
    }
  }, [selectedTarget, survivors]);

  const handleStartGame = useCallback(() => {
    // NPCを常に有効化（GamePong42では必須）
    if (engineRef.current) {
      engineRef.current.updateNPCConfig({
        player: 1 as 1 | 2, // Player 1 (上)がNPC
        mode: getCurrentNPC() as any,
        enabled: true,
        difficulty: 'Normal' as any,
      });
    }

    setGameStarted(true);
    setGameOver(false);
    setWinner(null);
  }, [getCurrentNPC, engineRef]);

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
    startGameLoop(handleScore, gameStarted, keysRef);

    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef]);

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
    setSelectedTarget(index);
  };

  const opponentCount = survivors - 1;

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
            {Array.from({ length: Math.min(21, opponentCount) }).map((_, i) => {
              const index = i;
              return (
                <div
                  key={`left-${index}`}
                  className={`cursor-pointer transition-all duration-200 relative ${
                    selectedTarget === index ? 'scale-105' : 'hover:scale-102'
                  }`}
                  style={{ width: "12.8vmin", height: "12.8vmin" }}
                  onClick={() => handleTargetSelect(index)}
                >
                  {selectedTarget === index && (
                    <img
                      src="/images/icons/target_circle.svg"
                      alt="Target"
                      className="absolute inset-0 w-full h-full opacity-80 z-10"
                    />
                  )}
                  {/* Mini pong game - same style as central */}
                  <div className="w-full h-full border border-white relative" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    {/* Player paddle (bottom) */}
                    <div className="absolute left-1/2 bottom-1 transform -translate-x-1/2 w-6 h-0.5 bg-white rounded"></div>

                    {/* NPC paddle (top) */}
                    <div className="absolute left-1/2 top-1 transform -translate-x-1/2 w-6 h-0.5 bg-white rounded"></div>

                    {/* Ball */}
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-0.5 bg-yellow-400 rounded-full"></div>
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
            {Array.from({ length: Math.min(21, Math.max(0, opponentCount - 21)) }).map((_, i) => {
              const index = 21 + i;
              return (
                <div
                  key={`right-${index}`}
                  className={`cursor-pointer transition-all duration-200 relative ${
                    selectedTarget === index ? 'scale-105' : 'hover:scale-102'
                  }`}
                  style={{ width: "12.8vmin", height: "12.8vmin" }}
                  onClick={() => handleTargetSelect(index)}
                >
                  {selectedTarget === index && (
                    <img
                      src="/images/icons/target_circle.svg"
                      alt="Target"
                      className="absolute inset-0 w-full h-full opacity-80 z-10"
                    />
                  )}
                  {/* Mini pong game - same style as central */}
                  <div className="w-full h-full border border-white relative" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    {/* Player paddle (bottom) */}
                    <div className="absolute left-1/2 bottom-1 transform -translate-x-1/2 w-6 h-0.5 bg-white rounded"></div>

                    {/* NPC paddle (top) */}
                    <div className="absolute left-1/2 top-1 transform -translate-x-1/2 w-6 h-0.5 bg-white rounded"></div>

                    {/* Ball */}
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-0.5 bg-yellow-400 rounded-full"></div>
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
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-40">
          <div className="text-8xl font-bold text-yellow-400 animate-pulse text-center">
            {survivors}<br/>SURVIVORS LEFT
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
