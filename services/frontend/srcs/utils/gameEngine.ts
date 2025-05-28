export interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  speed: number;
  speedMultiplier: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameState {
  ball: Ball;
  paddle1: Paddle;
  paddle2: Paddle;
  keys: { [key: string]: boolean };
  canvasWidth: number;
  canvasHeight: number;
  paddleHits: number;
}

export interface GameConfig {
  winningScore: number;
  maxBallSpeed: number;
  paddleSpeed: number;
  ballRadius: number;
  paddleWidth: number;
  paddleHeight: number;
  initialBallSpeed: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  winningScore: 11,
  maxBallSpeed: 12,
  paddleSpeed: 8,
  ballRadius: 8,
  paddleWidth: 80,
  paddleHeight: 12,
  initialBallSpeed: 4,
};

export class GameEngine {
  private state: GameState;
  private config: GameConfig;

  constructor(canvasWidth: number, canvasHeight: number, config: GameConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.state = {
      ball: {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        dx: 0,
        dy: 0,
        radius: config.ballRadius,
        speed: config.initialBallSpeed,
        speedMultiplier: 1,
      },
      paddle1: {
        x: canvasWidth / 2 - config.paddleWidth / 2,
        y: 20,
        width: config.paddleWidth,
        height: config.paddleHeight,
      },
      paddle2: {
        x: canvasWidth / 2 - config.paddleWidth / 2,
        y: canvasHeight - 20 - config.paddleHeight,
        width: config.paddleWidth,
        height: config.paddleHeight,
      },
      keys: {},
      canvasWidth,
      canvasHeight,
      paddleHits: 0,
    };
    this.resetBall();
  }

  public getState(): GameState {
    return this.state;
  }

  public updateCanvasSize(width: number, height: number): void {
    this.state.canvasWidth = width;
    this.state.canvasHeight = height;
    this.initializePositions();
  }

  public setKeyState(key: string, pressed: boolean): void {
    this.state.keys[key] = pressed;
  }

  public resetBall(): void {
    const { canvasWidth, canvasHeight } = this.state;
    this.state.ball.x = canvasWidth / 2;
    this.state.ball.y = canvasHeight / 2;
    
    const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
    const v = Math.random() > 0.5 ? 1 : -1;
    const h = Math.random() > 0.5 ? 1 : -1;
    
    this.state.ball.dy = this.state.ball.speed * Math.cos(angle) * v;
    this.state.ball.dx = this.state.ball.speed * Math.sin(angle) * h;
    this.state.ball.speedMultiplier = 1;
    this.state.paddleHits = 0;
  }

  private initializePositions(): void {
    const { canvasWidth, canvasHeight } = this.state;
    this.state.ball.x = canvasWidth / 2;
    this.state.ball.y = canvasHeight / 2;
    this.state.paddle1.x = canvasWidth / 2 - this.state.paddle1.width / 2;
    this.state.paddle1.y = 20;
    this.state.paddle2.x = canvasWidth / 2 - this.state.paddle2.width / 2;
    this.state.paddle2.y = canvasHeight - 20 - this.state.paddle2.height;
  }

  public update(): 'none' | 'player1' | 'player2' {
    this.updatePaddles();
    this.updateBall();
    return this.checkGoals();
  }

  private updatePaddles(): void {
    const { paddle1, paddle2, keys, canvasWidth } = this.state;
    const speed = this.config.paddleSpeed;

    // Player 1 (top paddle) - A/D keys
    if (keys['a'] && paddle1.x > 0) {
      paddle1.x -= speed;
    }
    if (keys['d'] && paddle1.x + paddle1.width < canvasWidth) {
      paddle1.x += speed;
    }

    // Player 2 (bottom paddle) - Arrow keys
    if (keys['arrowLeft'] && paddle2.x > 0) {
      paddle2.x -= speed;
    }
    if (keys['arrowRight'] && paddle2.x + paddle2.width < canvasWidth) {
      paddle2.x += speed;
    }
  }

  private updateBall(): void {
    const { ball, canvasWidth } = this.state;

    // Clamp speed
    const currentSpeed = Math.hypot(ball.dx, ball.dy) || 1;
    const maxSpeed = Math.min(ball.speedMultiplier, this.config.maxBallSpeed / ball.speed);
    ball.dx = (ball.dx / currentSpeed) * ball.speed * maxSpeed;
    ball.dy = (ball.dy / currentSpeed) * ball.speed * maxSpeed;

    // Move ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collision
    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvasWidth) {
      ball.dx *= -1;
      ball.x = Math.max(ball.radius, Math.min(ball.x, canvasWidth - ball.radius));
    }

    // Paddle collision
    this.checkPaddleCollision();
  }

  private checkPaddleCollision(): void {
    const { paddle1, paddle2 } = this.state;

    if (this.isColliding(paddle1, true)) {
      this.reflectBall(paddle1, true);
    } else if (this.isColliding(paddle2, false)) {
      this.reflectBall(paddle2, false);
    }
  }

  private isColliding(paddle: Paddle, isTop: boolean): boolean {
    const { ball } = this.state;
    const xOverlap = ball.x + ball.radius > paddle.x && ball.x - ball.radius < paddle.x + paddle.width;
    const yOverlap = isTop
      ? ball.y - ball.radius < paddle.y + paddle.height && ball.y + ball.radius > paddle.y
      : ball.y + ball.radius > paddle.y && ball.y - ball.radius < paddle.y + paddle.height;
    return xOverlap && yOverlap;
  }

  private reflectBall(paddle: Paddle, isTop: boolean): void {
    const { ball } = this.state;
    const hitPosition = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    const angle = hitPosition * (Math.PI / 3);
    
    this.state.paddleHits += 1;
    ball.speedMultiplier = Math.min(1 + this.state.paddleHits * 0.15, 4);
    
    const speed = Math.hypot(ball.dx, ball.dy);
    
    if (isTop) {
      ball.dx = Math.sin(angle) * speed;
      ball.dy = Math.abs(Math.cos(angle) * speed);
      ball.y = paddle.y + paddle.height + ball.radius;
    } else {
      ball.dx = Math.sin(Math.PI - angle) * speed;
      ball.dy = -Math.abs(Math.cos(angle) * speed);
      ball.y = paddle.y - ball.radius;
    }
  }

  private checkGoals(): 'none' | 'player1' | 'player2' {
    const { ball } = this.state;

    if (ball.y - ball.radius < 0) {
      this.resetBall();
      return 'player2'; // Player 2 scores
    } else if (ball.y + ball.radius > this.state.canvasHeight) {
      this.resetBall();
      return 'player1'; // Player 1 scores
    }

    return 'none';
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const { ball, paddle1, paddle2, canvasWidth } = this.state;

    ctx.clearRect(0, 0, canvasWidth, this.state.canvasHeight);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, 0, canvasWidth, this.state.canvasHeight);

    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#212121";
    ctx.fill();

    // Draw paddles
    ctx.fillStyle = "#212121";
    ctx.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
    ctx.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);
  }
}
