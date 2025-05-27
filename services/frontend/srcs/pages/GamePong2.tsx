import React, { useEffect, useRef, useState } from 'react';

interface GamePong2Props {
  navigate: (page: string) => void;
}

const GamePong2: React.FC<GamePong2Props> = ({ navigate }) => {
  // キャンバスの参照
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 背景画像の参照
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  
  // ゲーム状態
  const [gameStarted, setGameStarted] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const survivors = 2;
  const [roomNumber] = useState(Math.floor(10000 + Math.random() * 90000)); // 5桁のランダムな部屋番号
  
  // クラシックPongの設定
  const WINNING_SCORE = 11; // 11点先取で勝利
  const MAX_BALL_SPEED = 12; // ボールの最大速度

  // ゲームステートを参照として保持（useEffectからアクセスするため）
  const gameStateRef = useRef({
    ball: {
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
      radius: 8,
      speed: 4, // 初期速度
      speedMultiplier: 1.0, // 速度倍率（パドルヒットで上昇）
    },
    paddle1: {
      x: 0,
      y: 0,
      width: 12, // パドルの幅を少し増加
      height: 80,
      speed: 0,
    },
    paddle2: {
      x: 0,
      y: 0,
      width: 12, // パドルの幅を少し増加
      height: 80,
      speed: 0,
    },
    // キー入力の状態を追跡
    keys: {
      w: false,
      s: false,
      arrowUp: false,
      arrowDown: false,
    },
    canvasWidth: 0,
    canvasHeight: 0,
    paddleHits: 0, // パドルヒット回数カウンター
  });

  // 背景画像のロード
  useEffect(() => {
    const img = new Image();
    img.src = '/images/background/noon.png';
    img.onload = () => {
      setBackgroundImage(img);
    };
  }, []);

  // ゲームの初期化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !backgroundImage) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;

    // キャンバスサイズをウィンドウに合わせる
    const resizeCanvas = () => {
      const parentElement = canvas.parentElement;
      if (!parentElement) return;
      
      const parentWidth = parentElement.clientWidth;
      const parentHeight = parentElement.clientHeight;
      
      canvas.width = parentWidth;
      canvas.height = parentHeight;
      
      // ゲームステートのキャンバスサイズを更新
      gameStateRef.current.canvasWidth = canvas.width;
      gameStateRef.current.canvasHeight = canvas.height;

      // ゲーム要素の初期位置を設定
      initGameElements();
    };

    // ゲーム要素の初期位置設定
    const initGameElements = () => {
      const state = gameStateRef.current;
      // ボールを中央に配置
      state.ball.x = state.canvasWidth / 2;
      state.ball.y = state.canvasHeight / 2;
      
      // 初速をランダムに設定
      const angle = (Math.random() * 0.5 + 0.25) * Math.PI; // 45°～135°の範囲
      state.ball.dx = state.ball.speed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
      state.ball.dy = state.ball.speed * Math.sin(angle) * (Math.random() > 0.5 ? 1 : -1);
      state.ball.speedMultiplier = 1.0; // 速度倍率をリセット
      state.paddleHits = 0; // ヒット数リセット
      
      // パドルを両端に配置
      state.paddle1.x = 20;
      state.paddle1.y = state.canvasHeight / 2 - state.paddle1.height / 2;
      
      state.paddle2.x = state.canvasWidth - 20 - state.paddle2.width;
      state.paddle2.y = state.canvasHeight / 2 - state.paddle2.height / 2;
    };
    
    // キーボードイベントのリスナーを設定
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 's' || key === 'arrowup' || key === 'arrowdown') {
        e.preventDefault();  // ページスクロールを防止
        const keys = gameStateRef.current.keys;
        
        if (key === 'w') keys.w = true;
        else if (key === 's') keys.s = true;
        else if (key === 'arrowup') keys.arrowUp = true;
        else if (key === 'arrowdown') keys.arrowDown = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const keys = gameStateRef.current.keys;
      
      if (key === 'w') keys.w = false;
      else if (key === 's') keys.s = false;
      else if (key === 'arrowup') keys.arrowUp = false;
      else if (key === 'arrowdown') keys.arrowDown = false;
    };
    
    // イベントリスナーを追加
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // 初期サイズを設定
    resizeCanvas();
    
    // ゲームループを開始
    let animationFrameId: number;
    
    // ゲームを更新して描画
    const update = () => {
      if (!gameOver) {
        updateGameState();
      }
      renderGame();
      animationFrameId = requestAnimationFrame(update);
    };

    // ゲームステートを更新
    const updateGameState = () => {
      if (!gameStarted) return;
      
      const state = gameStateRef.current;
      
      // パドルの移動速度（一定）
      const PADDLE_SPEED = 8;
      
      // プレイヤー1のパドル制御（WとSキー）
      if (state.keys.w && state.paddle1.y > 0) {
        state.paddle1.y -= PADDLE_SPEED;
      }
      if (state.keys.s && state.paddle1.y + state.paddle1.height < state.canvasHeight) {
        state.paddle1.y += PADDLE_SPEED;
      }
      
      // プレイヤー2のパドル制御（上下矢印キー）
      if (state.keys.arrowUp && state.paddle2.y > 0) {
        state.paddle2.y -= PADDLE_SPEED;
      }
      if (state.keys.arrowDown && state.paddle2.y + state.paddle2.height < state.canvasHeight) {
        state.paddle2.y += PADDLE_SPEED;
      }
      
      // 速度制限の適用
      const currentSpeed = Math.sqrt(state.ball.dx * state.ball.dx + state.ball.dy * state.ball.dy);
      const speedFactor = Math.min(state.ball.speedMultiplier, MAX_BALL_SPEED / state.ball.speed);
      
      // 現在の方向を維持しながら速度を適用
      if (currentSpeed > 0) {
        state.ball.dx = (state.ball.dx / currentSpeed) * state.ball.speed * speedFactor;
        state.ball.dy = (state.ball.dy / currentSpeed) * state.ball.speed * speedFactor;
      }
      
      // ボールの位置を更新
      state.ball.x += state.ball.dx;
      state.ball.y += state.ball.dy;
      
      // 上下の壁での反射
      if (state.ball.y - state.ball.radius < 0 || 
          state.ball.y + state.ball.radius > state.canvasHeight) {
        state.ball.dy = -state.ball.dy;
        // 壁に埋まらないように調整
        if (state.ball.y - state.ball.radius < 0) {
          state.ball.y = state.ball.radius;
        } else {
          state.ball.y = state.canvasHeight - state.ball.radius;
        }
      }
      
      // パドルとの衝突判定
      // プレイヤー1のパドル
      if (
        state.ball.x - state.ball.radius < state.paddle1.x + state.paddle1.width &&
        state.ball.x + state.ball.radius > state.paddle1.x &&
        state.ball.y + state.ball.radius > state.paddle1.y &&
        state.ball.y - state.ball.radius < state.paddle1.y + state.paddle1.height
      ) {
        // ボールがパドルに埋まらないように位置調整
        state.ball.x = state.paddle1.x + state.paddle1.width + state.ball.radius;
        
        // パドルのどこに当たったかで反射角度を変える（-0.5〜0.5の範囲）
        const hitPosition = (state.ball.y - (state.paddle1.y + state.paddle1.height / 2)) / (state.paddle1.height / 2);
        
        // 反射角度の計算（中央:0°、端:±60°）
        const maxAngle = Math.PI / 3; // 60度
        const angle = hitPosition * maxAngle;
        
        // 速度の増加（ヒットごとに15%ずつ増加、最大4倍まで）
        state.paddleHits++;
        state.ball.speedMultiplier = Math.min(1.0 + (state.paddleHits * 0.15), 4.0);
        
        // 新しい方向を設定
        const speed = Math.sqrt(state.ball.dx * state.ball.dx + state.ball.dy * state.ball.dy);
        state.ball.dx = Math.cos(angle) * speed;
        state.ball.dy = Math.sin(angle) * speed;
        
        // 必ず右向きになるよう調整
        if (state.ball.dx < 0) state.ball.dx = -state.ball.dx;
      }
      
      // プレイヤー2のパドル
      if (
        state.ball.x + state.ball.radius > state.paddle2.x &&
        state.ball.x - state.ball.radius < state.paddle2.x + state.paddle2.width &&
        state.ball.y + state.ball.radius > state.paddle2.y &&
        state.ball.y - state.ball.radius < state.paddle2.y + state.paddle2.height
      ) {
        // ボールがパドルに埋まらないように位置調整
        state.ball.x = state.paddle2.x - state.ball.radius;
        
        // パドルのどこに当たったかで反射角度を変える（-0.5〜0.5の範囲）
        const hitPosition = (state.ball.y - (state.paddle2.y + state.paddle2.height / 2)) / (state.paddle2.height / 2);
        
        // 反射角度の計算（中央:0°、端:±60°）
        const maxAngle = Math.PI / 3; // 60度
        const angle = hitPosition * maxAngle;
        
        // 速度の増加（ヒットごとに15%ずつ増加、最大4倍まで）
        state.paddleHits++;
        state.ball.speedMultiplier = Math.min(1.0 + (state.paddleHits * 0.15), 4.0);
        
        // 新しい方向を設定
        const speed = Math.sqrt(state.ball.dx * state.ball.dx + state.ball.dy * state.ball.dy);
        state.ball.dx = Math.cos(Math.PI - angle) * speed;
        state.ball.dy = Math.sin(Math.PI - angle) * speed;
        
        // 必ず左向きになるよう調整
        if (state.ball.dx > 0) state.ball.dx = -state.ball.dx;
      }
      
      // 得点判定
      if (state.ball.x - state.ball.radius < 0) {
        // プレイヤー2の得点
        setScore(prev => {
          const newScore = { ...prev, player2: prev.player2 + 1 };
          
          // 勝敗判定
          if (newScore.player2 >= WINNING_SCORE) {
            setGameOver(true);
            setWinner(2);
          }
          
          return newScore;
        });
        resetBall();
      } else if (state.ball.x + state.ball.radius > state.canvasWidth) {
        // プレイヤー1の得点
        setScore(prev => {
          const newScore = { ...prev, player1: prev.player1 + 1 };
          
          // 勝敗判定
          if (newScore.player1 >= WINNING_SCORE) {
            setGameOver(true);
            setWinner(1);
          }
          
          return newScore;
        });
        resetBall();
      }
    };

    // ボールをリセット
    const resetBall = () => {
      const state = gameStateRef.current;
      state.ball.x = state.canvasWidth / 2;
      state.ball.y = state.canvasHeight / 2;
      
      // より自然な角度で発射
      const angle = (Math.random() * 0.5 + 0.25) * Math.PI; // 45°～135°の範囲
      state.ball.dx = state.ball.speed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
      state.ball.dy = state.ball.speed * Math.sin(angle) * (Math.random() > 0.5 ? 1 : -1);
      
      // 速度倍率をリセット（ラリーごとに速度リセット）
      state.ball.speedMultiplier = 1.0;
      state.paddleHits = 0;
    };

    // ゲームを描画
    const renderGame = () => {
      if (!context) return;
      
      const state = gameStateRef.current;
      
      // 背景をクリア
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // 背景画像を描画
      context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
      
      // 中央線を描画
      context.beginPath();
      context.setLineDash([10, 15]);
      context.moveTo(canvas.width / 2, 0);
      context.lineTo(canvas.width / 2, canvas.height);
      context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      context.lineWidth = 2;
      context.stroke();
      context.setLineDash([]);
      
      // スコアを描画（中央上部に大きく表示）
      context.font = 'bold 48px Futura';
      context.fillStyle = 'white';
      context.textAlign = 'center';
      context.fillText(`${score.player1}  -  ${score.player2}`, canvas.width / 2, 60);
      
      // ボールを描画
      context.beginPath();
      context.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
      context.fillStyle = '#FFFFFF';
      context.fill();
      context.closePath();
      
      // パドルを描画
      // プレイヤー1のパドル
      context.fillStyle = '#FFFFFF';
      context.fillRect(
        state.paddle1.x,
        state.paddle1.y,
        state.paddle1.width,
        state.paddle1.height
      );
      
      // プレイヤー2のパドル
      context.fillRect(
        state.paddle2.x,
        state.paddle2.y,
        state.paddle2.width,
        state.paddle2.height
      );
      
      // ゲームオーバー時の表示
      if (gameOver && winner) {
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(canvas.width / 4, canvas.height / 3, canvas.width / 2, canvas.height / 3);
        
        context.font = 'bold 36px Futura';
        context.fillStyle = '#FFFFFF';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`Player ${winner} Wins!`, canvas.width / 2, canvas.height / 2 - 20);
        context.font = '24px Futura';
        context.fillText('Final Score: ' + score.player1 + ' - ' + score.player2, canvas.width / 2, canvas.height / 2 + 20);
      }
    };
    
    // ゲームループを開始
    animationFrameId = requestAnimationFrame(update);
    
    // クリーンアップ関数
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [backgroundImage, gameStarted, gameOver, score]);

  // ゲーム開始処理
  const handleStartGame = () => {
    setGameStarted(true);
    setRoomClosed(true);
    setGameOver(false);
    setWinner(null);
    setScore({ player1: 0, player2: 0 });
  };

  // ゲームリスタート処理
  const handleRestartGame = () => {
    setGameOver(false);
    setWinner(null);
    setScore({ player1: 0, player2: 0 });
    // ボールとパドルの位置もリセット
    if (canvasRef.current) {
      const state = gameStateRef.current;
      state.ball.x = state.canvasWidth / 2;
      state.ball.y = state.canvasHeight / 2;
      state.ball.speedMultiplier = 1.0;
      state.paddleHits = 0;
      
      const angle = (Math.random() * 0.5 + 0.25) * Math.PI;
      state.ball.dx = state.ball.speed * Math.cos(angle) * (Math.random() > 0.5 ? 1 : -1);
      state.ball.dy = state.ball.speed * Math.sin(angle) * (Math.random() > 0.5 ? 1 : -1);
      
      state.paddle1.y = state.canvasHeight / 2 - state.paddle1.height / 2;
      state.paddle2.y = state.canvasHeight / 2 - state.paddle2.height / 2;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-['Futura'] relative">
      {!roomClosed && (
        <div className="absolute top-4 left-4 text-lg">Room: #{roomNumber}</div>
      )}
      
      {!roomClosed && (
        <button 
          className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 px-4 py-2 rounded"
          onClick={handleStartGame}
        >
          Close Room & Start
        </button>
      )}
      
      <h1 className="text-6xl font-bold mb-8">PONG 2</h1>
      
      <div className="w-full max-w-4xl aspect-video bg-transparent relative mb-8">
        {/* ゲーム画面 */}
        <canvas
          ref={canvasRef}
          className="w-full h-full border-4 border-blue-500"
        />
        
        {/* ゲーム開始前のオーバーレイ */}
        {!gameStarted && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <button
              onClick={handleStartGame}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-xl text-2xl"
            >
              Start Game
            </button>
          </div>
        )}
        
        {/* ゲームオーバーオーバーレイ（UIのみ、ゲーム内にもゲームオーバー表示あり） */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <button
              onClick={handleRestartGame}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-xl text-2xl mt-6 z-10"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between w-full max-w-4xl text-2xl mb-4">
        <div>Player 1: {score.player1}</div>
        <div className="text-yellow-400">{WINNING_SCORE}点先取で勝利!</div>
        <div>Player 2: {score.player2}</div>
      </div>
      
      <div className="text-2xl mb-8">Survivors: {survivors}</div>

      {/* コントロール説明 */}
      <div className="text-lg mb-8 flex gap-12">
        <div>
          <p className="font-bold mb-2">Player 1:</p>
          <p>W - Up</p>
          <p>S - Down</p>
        </div>
        <div>
          <p className="font-bold mb-2">Player 2:</p>
          <p>↑ - Up</p>
          <p>↓ - Down</p>
        </div>
      </div>

      {/* テクニック説明 */}
      <div className="text-lg mb-8 text-center max-w-lg text-gray-400">
        <p className="mb-2">📌 テクニック:</p>
        <p>パドルの端で打ち返すと、より急な角度でボールが反射します！</p>
        <p>ラリーが続くほどボールが加速します。最大4倍速まで！</p>
      </div>

      <div className="flex gap-6">
        <button
          onClick={() => navigate('GameResult')}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-xl transition duration-150"
        >
          End Game (To Result)
        </button>
        
        <button 
          onClick={() => navigate('GameSelect')} 
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-xl transition duration-150"
        >
          Back to Game Select
        </button>
      </div>
    </div>
  );
};

export default GamePong2;
