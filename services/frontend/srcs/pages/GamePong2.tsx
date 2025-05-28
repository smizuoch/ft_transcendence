import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * GamePong2 – UI‑refactor (square play area, avatar inside, score outside)
 * ------------------------------------------------------------
 * • Background image now covers the whole viewport via CSS.
 * • Play area is a PERFECT SQUARE centred on screen; canvas is resized to
 *   `min(window.innerWidth, window.innerHeight)` so it always fits.
 * • Avatars sit **inside** and scores sit **outside** (closer to the screen
 *   corner) per spec.
 * • Paddle & ball colours ⇒ #212121.
 */

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

const WINNING_SCORE = 11;
const MAX_BALL_SPEED = 12;

const defaultPlayers = {
  player1: { id: 1, avatar: "/images/mock/avatar1.png" },
  player2: { id: 2, avatar: "/images/mock/avatar2.png" },
};

const GamePong2: React.FC<GamePong2Props> = ({ navigate, players = defaultPlayers }) => {
  /* ────────── Canvas & game state ────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [roomNumber] = useState(Math.floor(10000 + Math.random() * 90000));
  const [iconsDocked, setIconsDocked] = useState(false);
  const ICON_LAUNCH_DELAY = 600;

  const gameStateRef = useRef({
    ball: { x: 0, y: 0, dx: 0, dy: 0, radius: 8, speed: 4, speedMultiplier: 1 },
    paddle1: { x: 0, y: 0, width: 80, height: 12 },
    paddle2: { x: 0, y: 0, width: 80, height: 12 },
    keys: { a: false, d: false, arrowLeft: false, arrowRight: false },
    canvasWidth: 0,
    canvasHeight: 0,
    paddleHits: 0,
  });

  /* ────────── Resize square canvas ────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const size = Math.min(window.innerWidth, window.innerHeight) * 0.9; // 90vmin
      canvas.width = size;
      canvas.height = size;
      gameStateRef.current.canvasWidth = size;
      gameStateRef.current.canvasHeight = size;
      initGameElements();
    };

    const initGameElements = () => {
      const st = gameStateRef.current;
      st.ball.x = st.canvasWidth / 2;
      st.ball.y = st.canvasHeight / 2;
      const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
      const vDir = Math.random() > 0.5 ? 1 : -1;
      const hDir = Math.random() > 0.5 ? 1 : -1;
      st.ball.dy = st.ball.speed * Math.cos(angle) * vDir;
      st.ball.dx = st.ball.speed * Math.sin(angle) * hDir;
      st.paddle1.x = st.canvasWidth / 2 - st.paddle1.width / 2;
      st.paddle1.y = 20;
      st.paddle2.x = st.canvasWidth / 2 - st.paddle2.width / 2;
      st.paddle2.y = st.canvasHeight - 20 - st.paddle2.height;
      st.paddleHits = 0;
      st.ball.speedMultiplier = 1;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  /* ────────── Keyboard control ────────── */
  useEffect(() => {
    const map: Record<string, keyof typeof gameStateRef.current.keys> = {
      a: "a",
      d: "d",
      ArrowLeft: "arrowLeft",
      ArrowRight: "arrowRight",
    };
    const down = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      e.preventDefault();
      gameStateRef.current.keys[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      gameStateRef.current.keys[k] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* ────────── Game loop ────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;

    const update = () => {
      const st = gameStateRef.current;
      if (gameStarted) {
        // paddles
        const SPD = 8;
        if (st.keys.a && st.paddle1.x > 0) st.paddle1.x -= SPD;
        if (st.keys.d && st.paddle1.x + st.paddle1.width < st.canvasWidth) st.paddle1.x += SPD;
        if (st.keys.arrowLeft && st.paddle2.x > 0) st.paddle2.x -= SPD;
        if (st.keys.arrowRight && st.paddle2.x + st.paddle2.width < st.canvasWidth)
          st.paddle2.x += SPD;

        // speed clamp
        const v = Math.hypot(st.ball.dx, st.ball.dy) || 1;
        const factor = Math.min(st.ball.speedMultiplier, MAX_BALL_SPEED / st.ball.speed);
        st.ball.dx = (st.ball.dx / v) * st.ball.speed * factor;
        st.ball.dy = (st.ball.dy / v) * st.ball.speed * factor;

        // move ball
        st.ball.x += st.ball.dx;
        st.ball.y += st.ball.dy;

        // wall bounce (left / right)
        if (st.ball.x - st.ball.radius < 0 || st.ball.x + st.ball.radius > st.canvasWidth) {
          st.ball.dx *= -1;
          st.ball.x = Math.max(st.ball.radius, Math.min(st.ball.x, st.canvasWidth - st.ball.radius));
        }

        // paddle collision helper
        const collide = (p: typeof st.paddle1, top: boolean) => {
          const withinX = st.ball.x + st.ball.radius > p.x && st.ball.x - st.ball.radius < p.x + p.width;
          const withinY = top
            ? st.ball.y - st.ball.radius < p.y + p.height && st.ball.y + st.ball.radius > p.y
            : st.ball.y + st.ball.radius > p.y && st.ball.y - st.ball.radius < p.y + p.height;
          return withinX && withinY;
        };

        const reflect = (p: typeof st.paddle1, hitTop: boolean) => {
          const hitPos = (st.ball.x - (p.x + p.width / 2)) / (p.width / 2);
          const angle = hitPos * (Math.PI / 3);
          st.paddleHits += 1;
          st.ball.speedMultiplier = Math.min(1 + st.paddleHits * 0.15, 4);
          const speed = Math.hypot(st.ball.dx, st.ball.dy);
          if (hitTop) {
            st.ball.dx = Math.sin(angle) * speed;
            st.ball.dy = Math.abs(Math.cos(angle) * speed);
            st.ball.y = p.y + p.height + st.ball.radius;
          } else {
            st.ball.dx = Math.sin(Math.PI - angle) * speed;
            st.ball.dy = -Math.abs(Math.cos(angle) * speed);
            st.ball.y = p.y - st.ball.radius;
          }
        };

        if (collide(st.paddle1, true)) reflect(st.paddle1, true);
        else if (collide(st.paddle2, false)) reflect(st.paddle2, false);

        // goal (top / bottom)
        if (st.ball.y - st.ball.radius < 0) {
          setScore((prev) => {
            const ns = { ...prev, player2: prev.player2 + 1 };
            if (ns.player2 >= WINNING_SCORE) {
              setGameOver(true);
              setWinner(2);
            }
            return ns;
          });
          resetBall();
        } else if (st.ball.y + st.ball.radius > st.canvasHeight) {
          setScore((prev) => {
            const ns = { ...prev, player1: prev.player1 + 1 };
            if (ns.player1 >= WINNING_SCORE) {
              setGameOver(true);
              setWinner(1);
            }
            return ns;
          });
          resetBall();
        }
      }

      draw();
      raf = requestAnimationFrame(update);
    };

    const resetBall = () => {
      const st = gameStateRef.current;
      st.ball.x = st.canvasWidth / 2;
      st.ball.y = st.canvasHeight / 2;
      const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
      const vDir = Math.random() > 0.5 ? 1 : -1;
      const hDir = Math.random() > 0.5 ? 1 : -1;
      st.ball.dy = st.ball.speed * Math.cos(angle) * vDir;
      st.ball.dx = st.ball.speed * Math.sin(angle) * hDir;
      st.ball.speedMultiplier = 1;
      st.paddleHits = 0;
    };

    const draw = () => {
      const st = gameStateRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height); // subtle tint so square is visible

      // ball
      ctx.beginPath();
      ctx.arc(st.ball.x, st.ball.y, st.ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#212121";
      ctx.fill();

      // paddles
      ctx.fillStyle = "#212121";
      ctx.fillRect(st.paddle1.x, st.paddle1.y, st.paddle1.width, st.paddle1.height);
      ctx.fillRect(st.paddle2.x, st.paddle2.y, st.paddle2.width, st.paddle2.height);
    };

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [gameStarted]);

  /* ────────── Intro avatar animation ────────── */
  useEffect(() => {
    if (gameStarted) {
      setIconsDocked(false);
      const t = setTimeout(() => setIconsDocked(true), ICON_LAUNCH_DELAY);
      return () => clearTimeout(t);
    }
  }, [gameStarted]);

  /* ────────── Auto‑navigate on win ────────── */
  useEffect(() => {
    if (gameOver && winner) {
      const t = setTimeout(() => navigate("GameResult"), 1200);
      return () => clearTimeout(t);
    }
  }, [gameOver, winner, navigate]);

  /* ────────── Handlers ────────── */
  const handleStartGame = useCallback(() => {
    setGameStarted(true);
    setRoomClosed(true);
    setGameOver(false);
    setWinner(null);
    setScore({ player1: 0, player2: 0 });
  }, []);

  /* ────────── Render helpers ────────── */
  const renderAvatarSlot = (idx: 1 | 2, corner: "bl" | "tr") => {
    const pts = idx === 1 ? score.player1 : score.player2;
    const initial = { transform: "translate(-50%, -50%)", left: "50%", top: "50%" };
    const dest = corner === "bl" 
      ? { bottom: "20px", left: "20px", transform: "translate(0, 0)" } 
      : { top: "20px", right: "20px", transform: "translate(0, 0)" };

    return (
      <div
        key={idx}
        style={{
          position: "absolute",
          transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          ...(iconsDocked ? dest : initial)
        }}
        className={`flex items-center gap-4 select-none pointer-events-none ${corner === "tr" ? "flex-row-reverse" : ""}`}
      >
        {/* score outermost */}
        {pts >= WINNING_SCORE ? (
          <img src="/images/win.svg" alt="win" className="w-12 h-12 lg:w-16 lg:h-16" />
        ) : (
          <span className="text-white font-extrabold text-6xl lg:text-8xl leading-none">{pts}</span>
        )}
        {/* avatar inner */}
        <img
          src={players[idx === 1 ? "player1" : "player2"].avatar}
          alt="avatar"
          className="w-12 h-12 lg:w-16 lg:h-16 rounded-full shadow-lg"
        />
      </div>
    );
  };

  /* ────────── JSX ────────── */
  return (
    <div
      className="relative w-full h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('/images/background/noon.png')" }}
    >
      <div className="relative" style={{ width: "90vmin", height: "90vmin" }}>
        <canvas ref={canvasRef} className="w-full h-full border border-white" />

        {/* overlay start screen */}
        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
            {!roomClosed ? (
              <>
                <div className="text-3xl mb-6">Room #{roomNumber}</div>
                <button onClick={handleStartGame} className=" bg-green-500 hover:bg-green-600 py-4 px-8 text-2xl rounded-xl font-bold">
                  Close Room & Start
                </button>
              </>
            ) : (
              <button onClick={handleStartGame} className="bg-green-500 hover:bg-green-600 py-4 px-8 text-2xl rounded-xl font-bold">
                Start Game
              </button>
            )}
          </div>
        )}

        {/* avatars + scores during play */}
        {gameStarted && !gameOver && (
          <>
            {renderAvatarSlot(1, "bl")}
            {renderAvatarSlot(2, "tr")}
          </>
        )}

        {/* winner overlay */}
        {gameOver && winner && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-5xl font-bold">
            Player {winner} Wins!
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePong2;
