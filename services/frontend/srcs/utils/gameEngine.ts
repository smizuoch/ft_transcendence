import { NPCEngine } from './npcEngine';
import { NPCConfig, DEFAULT_NPC_CONFIG } from './npcTypes';
import type { GameState, NPCDebugInfo } from './npcTypes';
import { DIFFICULTY_SETTINGS } from './npcTypes';

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

export interface GameConfig {
  winningScore: number;
  maxBallSpeed: number;
  paddleSpeed: number;
  ballRadius: number;
  paddleWidth: number;
  paddleHeight: number;
  initialBallSpeed: number;
  npc: NPCConfig;
}

export const DEFAULT_CONFIG: GameConfig = {
  winningScore: 11,
  maxBallSpeed: 12,
  paddleSpeed: 8,
  ballRadius: 8,
  paddleWidth: 80,
  paddleHeight: 12,
  initialBallSpeed: 4,
  npc: DEFAULT_NPC_CONFIG,
};

export class GameEngine {
  private state: GameState;
  private config: GameConfig;
  private npcEngine: NPCEngine | null = null;

  // パドルの速度追跡用
  private paddleVelocity = {
    paddle1: { x: 0, prevX: 0, lastUpdateTime: 0 },
    paddle2: { x: 0, prevX: 0, lastUpdateTime: 0 }
  };

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

  public setKeyState(): void {
    // キー状態は直接パドル更新で処理
  }

  public resetBall(lastScorer?: 'player1' | 'player2'): void {
    const { canvasWidth, canvasHeight } = this.state;
    this.state.ball.x = canvasWidth / 2;
    this.state.ball.y = canvasHeight / 2;

    // 得点者の方向にボールを射出するか、ランダム（ゲーム開始時）
    const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
    const h = Math.random() > 0.5 ? 1 : -1;

    let verticalDirection: number;

    // NPCが有効な場合は常にプレイヤー側にボールを向ける
    if (this.npcEngine && this.config.npc.enabled) {
      // NPCがPlayer1の場合はPlayer2（下）にボールを向ける
      // NPCがPlayer2の場合はPlayer1（上）にボールを向ける
      verticalDirection = this.config.npc.player === 1 ? 1 : -1;
    } else {
      // NPC無効時の従来のロジック
      if (lastScorer) {
        // 得点者の方向にボールを射出
        verticalDirection = lastScorer === 'player1' ? -1 : 1; // player1が得点 → 上方向(-1), player2が得点 → 下方向(1)
      } else {
        // ゲーム開始時やリセット時はランダム
        verticalDirection = Math.random() > 0.5 ? 1 : -1;
      }
    }

    this.state.ball.dy = this.state.ball.speed * Math.cos(angle) * verticalDirection;
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
    // パドル速度を更新
    this.updatePaddleVelocities();

    // NPC更新
    if (this.npcEngine) {
      this.npcEngine.updatePaddle(this.getGameState(), this.config.paddleSpeed);
    }

    this.updatePaddles();
    this.updateBall();
    return this.checkGoals();
  }

  private updatePaddleVelocities(): void {
    const currentTime = Date.now();
    const dt = Math.max((currentTime - this.paddleVelocity.paddle1.lastUpdateTime) / 1000, 1/60);

    // Paddle1の速度計算
    const paddle1DeltaX = this.state.paddle1.x - this.paddleVelocity.paddle1.prevX;
    this.paddleVelocity.paddle1.x = paddle1DeltaX / dt;
    this.paddleVelocity.paddle1.prevX = this.state.paddle1.x;
    this.paddleVelocity.paddle1.lastUpdateTime = currentTime;

    // Paddle2の速度計算
    const paddle2DeltaX = this.state.paddle2.x - this.paddleVelocity.paddle2.prevX;
    this.paddleVelocity.paddle2.x = paddle2DeltaX / dt;
    this.paddleVelocity.paddle2.prevX = this.state.paddle2.x;
    this.paddleVelocity.paddle2.lastUpdateTime = currentTime;
  }

  private updatePaddles(): void {
    // キーボード制御のみ（AIは別途処理済み）
    // キーボード制御は gameHooks で処理
  }

  private updateBall(): void {
    const { ball, canvasWidth } = this.state;

    const currentSpeed = Math.hypot(ball.dx, ball.dy) || 1;
    const maxSpeed = Math.min(ball.speedMultiplier, this.config.maxBallSpeed / ball.speed);
    ball.dx = (ball.dx / currentSpeed) * ball.speed * maxSpeed;
    ball.dy = (ball.dy / currentSpeed) * ball.speed * maxSpeed;

    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvasWidth) {
      ball.dx *= -1;
      ball.x = Math.max(ball.radius, Math.min(ball.x, canvasWidth - ball.radius));
    }

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

    // NPCの技効果をチェック
    const techniqueEffect = this.npcEngine?.getActiveTechniqueEffect();

    if (techniqueEffect && techniqueEffect.forceVerticalReturn) {
      // 【技効果による角度制御】
      // STRAIGHT技の場合：ほぼ垂直だが微小な水平成分を追加
      const speed = Math.hypot(ball.dx, ball.dy);

      // わずかな水平成分を追加（-5度から+5度の範囲）
      const minAngle = Math.PI / 90; // 5度
      const randomAngle = (Math.random() - 0.5) * 5 * minAngle; // -5度〜+5度

      // 水平成分と垂直成分を計算
      const horizontalComponent = Math.sin(randomAngle) * speed;
      const verticalComponent = Math.cos(randomAngle) * speed;

      if (isTop) {
        ball.dx = horizontalComponent; // わずかな水平成分
        ball.dy = Math.abs(verticalComponent); // 下向き
        ball.y = paddle.y + paddle.height + ball.radius;
      } else {
        ball.dx = horizontalComponent; // わずかな水平成分
        ball.dy = -Math.abs(verticalComponent); // 上向き
        ball.y = paddle.y - ball.radius;
      }

      // 技効果をリセット
      this.npcEngine?.resetTechniqueEffect();
    } else {
      // 【シンプルな角度決定システム（接触位置のみ）】
      // パドル上での接触位置を計算（-1.0 ～ +1.0の範囲）
      const hitPosition = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);

      // 接触位置を角度に変換（最大60度まで）
      const reflectionAngle = hitPosition * (Math.PI / 3); // Math.PI/3 = 60度

      // 現在のボール速度を保持
      const speed = Math.hypot(ball.dx, ball.dy);

      if (isTop) {
        // 上側パドル（Player1）との接触
        ball.dx = Math.sin(reflectionAngle) * speed; // 水平成分
        ball.dy = Math.abs(Math.cos(reflectionAngle) * speed); // 垂直成分（下向き）
        ball.y = paddle.y + paddle.height + ball.radius;
      } else {
        // 下側パドル（Player2）との接触
        ball.dx = Math.sin(Math.PI - reflectionAngle) * speed; // 水平成分（反転）
        ball.dy = -Math.abs(Math.cos(reflectionAngle) * speed); // 垂直成分（上向き）
        ball.y = paddle.y - ball.radius;
      }
    }

    // 【速度増加システム】
    this.state.paddleHits += 1;
    ball.speedMultiplier = Math.min(1 + this.state.paddleHits * 0.15, 4); // 最大4倍まで加速
  }

  private checkGoals(): 'none' | 'player1' | 'player2' {
    const { ball } = this.state;

    if (ball.y - ball.radius < 0) {
      this.resetBall('player2'); // player2が得点したので、player2の方向にボールを射出
      return 'player2';
    } else if (ball.y + ball.radius > this.state.canvasHeight) {
      this.resetBall('player1'); // player1が得点したので、player1の方向にボールを射出
      return 'player1';
    }

    return 'none';
  }

  public updateNPCConfig(config: Partial<NPCConfig>): void {
    this.config.npc = { ...this.config.npc, ...config };

    // 難易度設定の自動適用
    if (config.difficulty && config.difficulty !== 'Custom') {
      const settings = DIFFICULTY_SETTINGS[config.difficulty];
      if (config.mode === 'technician' && settings.technician) {
        this.config.npc.technician = { ...this.config.npc.technician, ...settings.technician };
      }
    }

    if (!this.npcEngine) {
      this.npcEngine = new NPCEngine(config as NPCConfig, this.state.canvasWidth);
    } else {
      this.npcEngine.updateConfig(config);
    }
  }

  public getNPCDebugInfo(): NPCDebugInfo | null {
    if (!this.npcEngine) return null;
    return this.npcEngine.getDebugInfo();
  }

  private getGameState(): GameState {
    return {
      ball: this.state.ball,
      paddle1: this.state.paddle1,
      paddle2: this.state.paddle2,
      canvasWidth: this.state.canvasWidth,
      canvasHeight: this.state.canvasHeight,
      paddleHits: this.state.paddleHits || 0,
    };
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const { ball, paddle1, paddle2, canvasWidth } = this.state;

    ctx.clearRect(0, 0, canvasWidth, this.state.canvasHeight);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, 0, canvasWidth, this.state.canvasHeight);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#212121";
    ctx.fill();

    ctx.fillStyle = "#212121";
    ctx.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
    ctx.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);
  }
}
