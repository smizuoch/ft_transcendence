import { NPCConfig, DIFFICULTY_SETTINGS, GameState } from './types';
import { PIDController } from './pidController';

export interface NPCAlgorithm {
  updatePosition(
    gameState: GameState,
    deltaTime: number,
    targetX?: number
  ): number;
  updateConfig(config: Partial<NPCConfig>): void;
  getName(): string;
  reset(): void;
}

export class PIDNPC implements NPCAlgorithm {
  private config: NPCConfig;
  private pidController: PIDController;
  private state: {
    rallyStartTime: number;
    targetX: number;
    lastUpdateTime: number;
  };

  constructor(config: NPCConfig, canvasWidth: number = 400) {
    this.config = config;
    this.state = {
      rallyStartTime: Date.now(),
      targetX: canvasWidth / 2,
      lastUpdateTime: Date.now(),
    };

    const pidConfig = this.config.pid || {
      kp: 1.0,
      ki: 0.1,
      kd: 0.08,
      maxIntegral: 80,
      derivativeFilter: 0.4,
      maxControlSpeed: 600,
    };

    this.pidController = new PIDController(
      pidConfig.kp,
      pidConfig.ki,
      pidConfig.kd,
      pidConfig.maxIntegral,
      pidConfig.derivativeFilter,
      pidConfig.maxControlSpeed
    );
  }

  public updateConfig(config: Partial<NPCConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.difficulty && config.difficulty !== 'Custom') {
      const settings = DIFFICULTY_SETTINGS[config.difficulty];
      if (settings.pid) {
        this.config.pid = {
          ...this.config.pid,
          ...settings.pid
        };
      }

      // 他の設定も更新
      this.config.returnRate = settings.returnRate;
      this.config.reactionDelayMs = settings.reactionDelayMs;
      this.config.maxSpeed = settings.maxSpeed;
      this.config.trackingNoise = settings.trackingNoise;
      this.config.trackingTimeout = settings.trackingTimeout;
    }

    // PIDコントローラーの再構築
    if (this.config.pid) {
      this.pidController = new PIDController(
        this.config.pid.kp,
        this.config.pid.ki,
        this.config.pid.kd,
        this.config.pid.maxIntegral,
        this.config.pid.derivativeFilter,
        this.config.pid.maxControlSpeed
      );
    }
  }

  public updatePosition(
    gameState: GameState,
    deltaTime: number,
    targetX?: number
  ): number {
    const currentTime = Date.now();

    // リアクション遅延のシミュレーション
    if (currentTime - this.state.lastUpdateTime < this.config.reactionDelayMs) {
      return this.getCurrentPaddlePosition(gameState);
    }

    let target = targetX;
    if (target === undefined) {
      target = this.calculateTarget(gameState);
    }

    // ノイズの追加
    if (this.config.trackingNoise > 0) {
      target += (Math.random() - 0.5) * this.config.trackingNoise;
    }

    const currentPaddleX = this.getCurrentPaddlePosition(gameState);
    const paddleCenter = currentPaddleX + gameState.paddle1.width / 2;

    // PID制御による位置計算
    const controlOutput = this.pidController.update(target, paddleCenter, deltaTime);

    // 速度制限の適用
    const maxSpeed = this.config.maxSpeed * 400; // ピクセル/秒
    const limitedSpeed = Math.max(-maxSpeed, Math.min(maxSpeed, controlOutput));

    // 新しい位置の計算
    let newPaddleX = currentPaddleX + (limitedSpeed * deltaTime);

    // 画面境界の制限
    newPaddleX = Math.max(0, Math.min(gameState.canvasWidth - gameState.paddle1.width, newPaddleX));

    this.state.lastUpdateTime = currentTime;
    return newPaddleX;
  }

  private getCurrentPaddlePosition(gameState: GameState): number {
    return this.config.player === 1 ? gameState.paddle1.x : gameState.paddle2.x;
  }

  private calculateTarget(gameState: GameState): number {
    const ball = gameState.ball;
    const paddle = this.config.player === 1 ? gameState.paddle1 : gameState.paddle2;

    // ボールがパドルに向かっているかチェック
    const isApproaching = this.config.player === 1 ? ball.dy < 0 : ball.dy > 0;

    if (!isApproaching) {
      // ボールが離れている場合は中央に戻る
      return gameState.canvasWidth / 2 - paddle.width / 2;
    }

    // ボールの予測位置を計算
    const timeToReachPaddle = this.calculateTimeToReachPaddle(gameState);
    const predictedX = ball.x + ball.dx * timeToReachPaddle;

    // returnRateに基づいて目標位置を調整
    if (Math.random() > this.config.returnRate) {
      // ミスをシミュレート
      return predictedX + (Math.random() - 0.5) * paddle.width * 2;
    }

    return predictedX - paddle.width / 2;
  }

  private calculateTimeToReachPaddle(gameState: GameState): number {
    const ball = gameState.ball;
    const paddle = this.config.player === 1 ? gameState.paddle1 : gameState.paddle2;

    const targetY = this.config.player === 1 ? paddle.y + paddle.height : paddle.y;
    const distanceY = Math.abs(ball.y - targetY);

    return distanceY / Math.abs(ball.dy);
  }

  public getName(): string {
    return 'PID NPC';
  }

  public reset(): void {
    this.pidController.reset();
    this.state.rallyStartTime = Date.now();
    this.state.lastUpdateTime = Date.now();
  }
}
