import { NPCConfig, DIFFICULTY_SETTINGS } from './npcTypes';
import { NPCAlgorithm, NPCFactory } from './npcEngine';
import { PIDController } from './pidController';

export class PIDNPC implements NPCAlgorithm {
  private config: NPCConfig;
  private pidController: PIDController;
  private state: {
    rallyStartTime: number;
    targetX: number;
    lastUpdateTime: number;
  };
  private pidDebugInfo: { error: number; p: number; i: number; d: number; output: number } | null = null;

  constructor(config: NPCConfig, _canvasWidth?: number) {
    this.config = config;
    this.state = {
      rallyStartTime: Date.now(),
      targetX: _canvasWidth ? _canvasWidth / 2 : 400,
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
    }

    if (config.pid || config.difficulty) {
      const pidConfig = this.config.pid;
      if (pidConfig) {
        this.pidController.updateGains(
          pidConfig.kp,
          pidConfig.ki,
          pidConfig.kd,
          pidConfig.maxIntegral,
          pidConfig.derivativeFilter,
          pidConfig.maxControlSpeed
        );
      }
    }

    if (config.mode === 'pid') {
      this.pidController.reset();
      this.state.rallyStartTime = Date.now();
    }
  }

  public calculateMovement(gameState: any, npcPaddle: { x: number; y: number; width: number; height: number }, _paddleSpeed?: number): { targetX: number; pidOutput: number } {
    const predictedBallX = this.predictBallIntersection(gameState, npcPaddle);
    const ballHeadingToNPC = this.config.player === 1 ? gameState.ball.dy < 0 : gameState.ball.dy > 0;

    let targetX: number;

    if (ballHeadingToNPC && Math.abs(gameState.ball.dy) > 0.1) {
      // ボールがNPC方向に向かっている場合
      const noise = (Math.random() - 0.5) * (this.config.trackingNoise || 10) * 0.7;
      targetX = predictedBallX + noise;

      // 難易度調整
      const rallyTime = (Date.now() - this.state.rallyStartTime) / 1000;
      const difficultyFactor = Math.max(0.4, 1.0 - Math.min(rallyTime / 25, 0.6));

      const pidConfig = this.config.pid;
      if (pidConfig) {
        this.pidController.updateGains(
          pidConfig.kp * difficultyFactor * 0.95,
          pidConfig.ki * 0.85,
          pidConfig.kd * difficultyFactor * 0.8,
          pidConfig.maxIntegral,
          Math.max(0.2, pidConfig.derivativeFilter),
          pidConfig.maxControlSpeed * difficultyFactor * 0.85
        );
      }
    } else {
      // ボールが向かってこない場合は中央に戻る
      targetX = gameState.canvasWidth / 2;

      const pidConfig = this.config.pid;
      if (pidConfig) {
        this.pidController.updateGains(
          pidConfig.kp * 0.35,
          pidConfig.ki * 0.4,
          pidConfig.kd * 0.3,
          pidConfig.maxIntegral,
          0.7,
          pidConfig.maxControlSpeed * 0.4
        );
      }
    }

    const currentPaddleCenter = npcPaddle.x + npcPaddle.width / 2;
    const controlOutput = this.pidController.update(targetX, currentPaddleCenter);

    this.state.targetX = targetX;
    this.pidDebugInfo = this.pidController.getDebugInfo();

    return {
      targetX: targetX,
      pidOutput: controlOutput
    };
  }

  private predictBallIntersection(gameState: any, npcPaddle: { y: number }): number {
    const { ball } = gameState;

    const isMovingTowardsNPC = this.config.player === 1 ? ball.dy < 0 : ball.dy > 0;
    if (!isMovingTowardsNPC || Math.abs(ball.dy) < 0.1) {
      return ball.x;
    }

    let futureX = ball.x;
    let futureDX = ball.dx;
    const targetY = npcPaddle.y;
    const steps = Math.abs((targetY - ball.y) / ball.dy);

    for (let i = 0; i < steps; i++) {
      futureX += futureDX;

      if (futureX < 0) {
        futureX = -futureX;
        futureDX = -futureDX;
      } else if (futureX > gameState.canvasWidth) {
        futureX = 2 * gameState.canvasWidth - futureX;
        futureDX = -futureDX;
      }
    }

    return futureX;
  }

  public getDebugInfo(): { error: number; p: number; i: number; d: number; output: number } | null {
    return this.pidDebugInfo;
  }

  public getCurrentState(): string {
    return 'PID';
  }

  public getStateStartTime(): number {
    return this.state.rallyStartTime;
  }

  public getTargetPosition(): number {
    return this.state.targetX;
  }
}

// ファクトリーにアルゴリズムを登録
NPCFactory.registerAlgorithm('pid', PIDNPC);
