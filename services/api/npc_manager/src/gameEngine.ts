import { GameState, GameConfig, DEFAULT_CONFIG, Ball, Paddle } from './types';
import { PIDNPC } from './npcEngine';

export class NPCGameEngine {
  private state: GameState;
  private config: GameConfig;
  private npc1: PIDNPC;
  private npc2: PIDNPC;
  private score: { player1: number; player2: number };
  private lastUpdateTime: number;
  private isRunning: boolean;

  constructor(canvasWidth: number, canvasHeight: number, config: GameConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.score = { player1: 0, player2: 0 };
    this.lastUpdateTime = Date.now();
    this.isRunning = true;

    // 比率から実際のサイズを計算
    const ballRadius = canvasWidth * config.ballRadiusRatio;
    const paddleWidth = canvasWidth * config.paddleWidthRatio;
    const paddleHeight = canvasHeight * config.paddleHeightRatio;

    this.state = {
      ball: {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        dx: 0,
        dy: 0,
        radius: ballRadius,
        speed: config.initialBallSpeed,
        speedMultiplier: 1,
      },
      paddle1: {
        x: canvasWidth / 2 - paddleWidth / 2,
        y: 20,
        width: paddleWidth,
        height: paddleHeight,
      },
      paddle2: {
        x: canvasWidth / 2 - paddleWidth / 2,
        y: canvasHeight - 20 - paddleHeight,
        width: paddleWidth,
        height: paddleHeight,
      },
      canvasWidth,
      canvasHeight,
      paddleHits: 0,
    };

    // NPC設定
    const npc1Config = { ...config.npc, player: 1 as const };
    const npc2Config = config.npc2 ? { ...config.npc2, player: 2 as const } : { ...config.npc, player: 2 as const };

    this.npc1 = new PIDNPC(npc1Config, canvasWidth);
    this.npc2 = new PIDNPC(npc2Config, canvasWidth);

    this.resetBall();
  }

  public update(): void {
    if (!this.isRunning) return;

    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // 秒に変換
    this.lastUpdateTime = currentTime;

    // NPCパドルの更新
    this.state.paddle1.x = this.npc1.updatePosition(this.state, deltaTime);
    this.state.paddle2.x = this.npc2.updatePosition(this.state, deltaTime);

    // ボールの更新
    this.updateBall(deltaTime);

    // 得点チェック
    this.checkScore();
  }

  private updateBall(deltaTime: number): void {
    const ball = this.state.ball;

    // ボールの位置更新（speedMultiplierを反映）
    const baseSpeed = 60; // 基準速度
    const actualSpeed = baseSpeed * ball.speedMultiplier;
    ball.x += ball.dx * deltaTime * actualSpeed;
    ball.y += ball.dy * deltaTime * actualSpeed;

    // 左右の壁との衝突
    if (ball.x <= ball.radius || ball.x >= this.state.canvasWidth - ball.radius) {
      ball.dx = -ball.dx;
      ball.x = ball.x <= ball.radius ? ball.radius : this.state.canvasWidth - ball.radius;
    }

    // パドルとの衝突チェック
    this.checkPaddleCollision();
  }

  private checkPaddleCollision(): void {
    const ball = this.state.ball;
    const paddle1 = this.state.paddle1;
    const paddle2 = this.state.paddle2;

    // Paddle1との衝突 (上のパドル)
    if (ball.dy < 0 &&
        ball.y - ball.radius <= paddle1.y + paddle1.height &&
        ball.y - ball.radius >= paddle1.y &&
        ball.x >= paddle1.x &&
        ball.x <= paddle1.x + paddle1.width) {

      this.handlePaddleHit(paddle1, 1);
    }

    // Paddle2との衝突 (下のパドル)
    if (ball.dy > 0 &&
        ball.y + ball.radius >= paddle2.y &&
        ball.y + ball.radius <= paddle2.y + paddle2.height &&
        ball.x >= paddle2.x &&
        ball.x <= paddle2.x + paddle2.width) {

      this.handlePaddleHit(paddle2, 2);
    }
  }

  private handlePaddleHit(paddle: Paddle, player: number): void {
    const ball = this.state.ball;

    // ボールの反射
    ball.dy = -ball.dy;

    // パドルの端での角度変更
    const hitPosition = (ball.x - paddle.x) / paddle.width; // 0-1の範囲
    const angle = (hitPosition - 0.5) * 0.5; // -0.25 to 0.25 radians

    ball.dx += Math.sin(angle) * ball.speed * 0.3;

    // 速度制限
    const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    if (currentSpeed > this.config.maxBallSpeed) {
      const ratio = this.config.maxBallSpeed / currentSpeed;
      ball.dx *= ratio;
      ball.dy *= ratio;
    }

    // ボールの位置調整
    if (player === 1) {
      ball.y = paddle.y + paddle.height + ball.radius;
    } else {
      ball.y = paddle.y - ball.radius;
    }

    this.state.paddleHits++;
    // パドル衝突時にボール速度を加速
    this.state.ball.speedMultiplier = Math.min(1 + this.state.paddleHits * 0.04, 4); // 加速率を半分に（0.08 → 0.04）
  }

  private checkScore(): void {
    const ball = this.state.ball;

    if (ball.y <= 0) {
      // Player2の得点
      this.score.player2++;
      this.onPlayerScore('player2');
    } else if (ball.y >= this.state.canvasHeight) {
      // Player1の得点
      this.score.player1++;
      this.onPlayerScore('player1');
    }
  }

  private onPlayerScore(scorer: 'player1' | 'player2'): void {
    if (scorer === 'player1') {
      // Player1が得点した場合、ゲーム終了
      this.isRunning = false;
    } else {
      // Player2が得点した場合、ゲームリセット
      this.resetBall(scorer);
    }
  }

  private resetBall(lastScorer?: 'player1' | 'player2'): void {
    const ball = this.state.ball;

    ball.x = this.state.canvasWidth / 2;
    ball.y = this.state.canvasHeight / 2;

    // ランダムな角度でボールを射出
    const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
    const direction = Math.random() > 0.5 ? 1 : -1;

    let verticalDirection: number;

    // ミニゲーム判定（100x100のキャンバス）：初球は必ずPlayer1側に向ける
    if (this.state.canvasWidth === 100 && this.state.canvasHeight === 100) {
      if (!lastScorer) {
        // ミニゲームの初球はPlayer1（上）側に向ける
        verticalDirection = -1; // 上方向
      } else {
        // 得点後は得点者の方向にボールを射出
        verticalDirection = lastScorer === 'player1' ? -1 : 1;
      }
    } else {
      // 通常のランダム方向
      verticalDirection = Math.random() > 0.5 ? 1 : -1;
    }

    ball.dx = ball.speed * Math.sin(angle) * direction;
    ball.dy = ball.speed * Math.cos(angle) * verticalDirection;
    ball.speedMultiplier = 1;
    this.state.paddleHits = 0;

    // NPCをリセット
    this.npc1.reset();
    this.npc2.reset();
  }

  public getState(): GameState {
    return { ...this.state };
  }

  public getScore(): { player1: number; player2: number } {
    return { ...this.score };
  }

  public isGameRunning(): boolean {
    return this.isRunning;
  }

  public getWinner(): 'player1' | 'player2' | null {
    if (!this.isRunning) {
      return 'player1'; // Player1が得点してゲーム終了
    }
    return null;
  }

  public applySpeedBoost(): void {
    if (this.isRunning) {
      this.state.ball.speedMultiplier *= 1.2;
      this.state.ball.dx *= 1.2;
      this.state.ball.dy *= 1.2;
    }
  }
}
