import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import type { NPCConfig } from "@/utils/npcTypes";
import { NPCSettingsPanel } from "@/utils/NPCSettingsPanel";
import { NPCDebugPanel } from "@/utils/NPCDebugPanel";
// NPCアルゴリズムの登録を確実に行うためにインポート
import "@/utils/npcAlgorithmRegistry";

interface PlayerInfo {
  id: number | string;
  avatar: string;
}

interface GamePong2Props {
  navigate: (page: string) => void;
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

const GamePong2: React.FC<GamePong2Props> = ({ navigate, players = defaultPlayers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [roomNumber] = useState(Math.floor(100000 + Math.random() * 900000));
  const [hoverClose, setHoverClose] = useState(false);
  const [iconsDocked, setIconsDocked] = useState(false);
  const ICON_LAUNCH_DELAY = 600;  // ============= NPC関連の状態 =============
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
  void engineRef;

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
    });
  }, []);  useEffect(() => {
    if (gameStarted) {
      startGameLoop(handleScore, gameStarted, keysRef, '#212121', npcEnabled);
    } else {
      stopGameLoop();
    }

    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef, npcEnabled]);

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
  const handleStartGame = useCallback(() => {
    // ============= モード設定：PVP vs PVE =============
    if (npcEnabled && engineRef.current) {
      // PVEモード: Player1 = technicianNPC, Player2 = プレイヤー
      engineRef.current.updateNPCConfig({
        ...npcSettings,
        enabled: true,
        player: 1, // Player1をNPCに設定
        mode: 'technician', // technicianNPCに固定
        difficulty: 'Nightmare', // Nightmare難易度に固定
        reactionDelayMs: 50, // 50ms固定
      });
    } else if (engineRef.current) {
      // PVPモード: Player1 = プレイヤー, Player2 = プレイヤー
      engineRef.current.updateNPCConfig({ enabled: false });
    }

    setGameStarted(true);
    setGameOver(false);
    setWinner(null);
    setScore({ player1: 0, player2: 0 });
  }, [npcEnabled, npcSettings, engineRef]);

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
    );
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
            <div className="text-5xl mb-4 tracking-widest" style={{ color: "#212121" }}>
              {roomNumber.toString().padStart(6, "0")}
            </div>

            {/* モード表示 */}
            <div className="text-2xl mb-8 tracking-wider" style={{ color: "#212121" }}>
              {npcEnabled ? (
                <span>🤖 PVE モード (プレイヤー vs AI)</span>
              ) : (
                <span>👥 PVP モード (プレイヤー vs プレイヤー)</span>
              )}
            </div>

            {/* コントロール説明 */}
            <div className="text-sm mb-6 text-center" style={{ color: "#212121" }}>
              {npcEnabled ? (
                <>
                  <div>Player 1 (上): 🤖 Technician AI</div>
                  <div>Player 2 (下): ← → キー</div>
                </>
              ) : (
                <>
                  <div>Player 1 (上): A D キー</div>
                  <div>Player 2 (下): ← → キー</div>
                </>
              )}
            </div>

            <img
              src={`${ICON_PATH}${hoverClose ? "close" : "open"}.svg`}
              alt="toggle"
              className="w-40 h-40 cursor-pointer"
              onMouseEnter={() => setHoverClose(true)}
              onMouseLeave={() => setHoverClose(false)}
              onClick={handleStartGame}
            />
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
