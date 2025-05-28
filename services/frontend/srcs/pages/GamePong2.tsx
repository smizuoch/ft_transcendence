import React, { useCallback, useEffect, useRef, useState } from "react";

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
const ICON_PATH = "/images/icons/";

const defaultPlayers = {
  player1: { id: 1, avatar: "/images/avatar/default_avatar.png" },
  player2: { id: 2, avatar: "/images/avatar/default_avatar1.png" },
};

const GamePong2: React.FC<GamePong2Props> = ({ navigate, players = defaultPlayers }) => {
  /* ───── Gameplay refs & state ───── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [roomNumber] = useState(Math.floor(100000 + Math.random() * 900000));
  const [hoverClose, setHoverClose] = useState(false);
  const [iconsDocked, setIconsDocked] = useState(false);
  const ICON_LAUNCH_DELAY = 600;

  const gameStateRef = useRef({
    ball: { x: 0, y: 0, dx: 0, dy: 0, radius: 8, speed: 4, speedMultiplier: 1 },
    paddle1: { x: 0, y: 0, width: 80, height: 12 }, // top paddle (opponent)
    paddle2: { x: 0, y: 0, width: 80, height: 12 }, // bottom paddle (self)
    keys: { a: false, d: false, arrowLeft: false, arrowRight: false },
    canvasWidth: 0,
    canvasHeight: 0,
    paddleHits: 0,
  });

  /* ───── Square canvas resize ───── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
      canvas.width = size;
      canvas.height = size;
      gameStateRef.current.canvasWidth = size;
      gameStateRef.current.canvasHeight = size;
      initElements();
    };
    const initElements = () => {
      const st = gameStateRef.current;
      st.ball.x = st.canvasWidth / 2;
      st.ball.y = st.canvasHeight / 2;
      const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
      const v = Math.random() > 0.5 ? 1 : -1;
      const h = Math.random() > 0.5 ? 1 : -1;
      st.ball.dy = st.ball.speed * Math.cos(angle) * v;
      st.ball.dx = st.ball.speed * Math.sin(angle) * h;
      st.paddle1.x = st.canvasWidth / 2 - st.paddle1.width / 2;
      st.paddle1.y = 20;
      st.paddle2.x = st.canvasWidth / 2 - st.paddle2.width / 2;
      st.paddle2.y = st.canvasHeight - 20 - st.paddle2.height;
      st.paddleHits = 0;
      st.ball.speedMultiplier = 1;
    };
    window.addEventListener("resize", resize);
    resize();
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ───── Keyboard ───── */
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

  /* ───── Game loop ───── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;

    const resetBall = () => {
      const st = gameStateRef.current;
      st.ball.x = st.canvasWidth / 2;
      st.ball.y = st.canvasHeight / 2;
      const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
      const v = Math.random() > 0.5 ? 1 : -1;
      const h = Math.random() > 0.5 ? 1 : -1;
      st.ball.dy = st.ball.speed * Math.cos(angle) * v;
      st.ball.dx = st.ball.speed * Math.sin(angle) * h;
      st.ball.speedMultiplier = 1;
      st.paddleHits = 0;
    };

    const update = () => {
      const st = gameStateRef.current;
      if (gameStarted) {
        // paddles (P2 bottom self = Arrows, P1 top opponent = A/D)
        const SPD = 8;
        if (st.keys.a && st.paddle1.x > 0) st.paddle1.x -= SPD;
        if (st.keys.d && st.paddle1.x + st.paddle1.width < st.canvasWidth) st.paddle1.x += SPD;
        if (st.keys.arrowLeft && st.paddle2.x > 0) st.paddle2.x -= SPD;
        if (st.keys.arrowRight && st.paddle2.x + st.paddle2.width < st.canvasWidth) st.paddle2.x += SPD;

        // clamp speed
        const vNow = Math.hypot(st.ball.dx, st.ball.dy) || 1;
        const factor = Math.min(st.ball.speedMultiplier, MAX_BALL_SPEED / st.ball.speed);
        st.ball.dx = (st.ball.dx / vNow) * st.ball.speed * factor;
        st.ball.dy = (st.ball.dy / vNow) * st.ball.speed * factor;

        // move ball
        st.ball.x += st.ball.dx;
        st.ball.y += st.ball.dy;

        // wall bounce
        if (st.ball.x - st.ball.radius < 0 || st.ball.x + st.ball.radius > st.canvasWidth) {
          st.ball.dx *= -1;
          st.ball.x = Math.max(st.ball.radius, Math.min(st.ball.x, st.canvasWidth - st.ball.radius));
        }

        // paddle collision helpers
        const collide = (p: typeof st.paddle1, top: boolean) => {
          const xOk = st.ball.x + st.ball.radius > p.x && st.ball.x - st.ball.radius < p.x + p.width;
          const yOk = top
            ? st.ball.y - st.ball.radius < p.y + p.height && st.ball.y + st.ball.radius > p.y
            : st.ball.y + st.ball.radius > p.y && st.ball.y - st.ball.radius < p.y + p.height;
          return xOk && yOk;
        };
        const reflect = (p: typeof st.paddle1, top: boolean) => {
          const hitPos = (st.ball.x - (p.x + p.width / 2)) / (p.width / 2);
          const angle = hitPos * (Math.PI / 3);
          st.paddleHits += 1;
          st.ball.speedMultiplier = Math.min(1 + st.paddleHits * 0.15, 4);
          const speed = Math.hypot(st.ball.dx, st.ball.dy);
          if (top) {
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

        // goal: top => P2 (self) scores, bottom => P1 (opponent) scores
        if (st.ball.y - st.ball.radius < 0) {
          // self scores
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
          // opponent scores
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

    const draw = () => {
      const st = gameStateRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(st.ball.x, st.ball.y, st.ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#212121";
      ctx.fill();
      ctx.fillStyle = "#212121";
      ctx.fillRect(st.paddle1.x, st.paddle1.y, st.paddle1.width, st.paddle1.height);
      ctx.fillRect(st.paddle2.x, st.paddle2.y, st.paddle2.width, st.paddle2.height);
    };

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [gameStarted]);

  /* intro dock */
  useEffect(() => {
    if (!gameStarted) return;
    setIconsDocked(false);
    const t = setTimeout(() => setIconsDocked(true), ICON_LAUNCH_DELAY);
    return () => clearTimeout(t);
  }, [gameStarted]);

  /* auto nav */
  useEffect(() => {
    if (gameOver && winner) {
      const t = setTimeout(() => navigate("GameResult"), 1200);
      return () => clearTimeout(t);
    }
  }, [gameOver, winner, navigate]);

  /* handlers */
  const handleStartGame = useCallback(() => {
    setGameStarted(true);
    setGameOver(false);
    setWinner(null);
    setScore({ player1: 0, player2: 0 });
  }, []);

  /* avatar groups */
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
        {pts >= WINNING_SCORE ? (
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

  /* ───── JSX ───── */
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
              {renderAvatarGroup(1, "right") /* opponent (top paddle) score at right side */}
              {renderAvatarGroup(2, "left") /* self (bottom paddle) score at left side */}
            </>
          )}
        </div>

        {/* opening screen (no mask) */}
        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl mb-8 tracking-widest" style={{ color: "#212121" }}>
              {roomNumber.toString().padStart(6, "0")}
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
    </div>
  );
};

export default GamePong2;
