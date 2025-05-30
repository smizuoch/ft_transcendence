import { NPCConfig, DIFFICULTY_SETTINGS } from './npcTypes';
import { NPCAlgorithm, NPCFactory } from './npcEngine';

class PIDController {
  private integral: number;
  private lastError: number;
  private lastTime: number;

  constructor(
    public kp: number,
    public ki: number,
    public kd: number,
    public maxIntegral: number,
    public derivativeFilter: number,
    public maxControlSpeed: number
  ) {
    this.integral = 0;
    this.lastError = 0;
    this.lastTime = Date.now();
  }

  public updateGains(kp: number, ki: number, kd: number, maxIntegral: number, derivativeFilter: number, maxControlSpeed: number) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.maxIntegral = maxIntegral;
    this.derivativeFilter = derivativeFilter;
    this.maxControlSpeed = maxControlSpeed;
  }

  public update(setPoint: number, processVariable: number): number {
    const now = Date.now();
    const timeChange = (now - this.lastTime) / 1000; // 秒単位
    this.lastTime = now;

    const error = setPoint - processVariable;

    // 積分制御
    this.integral += error * timeChange;
    if (this.integral > this.maxIntegral) {
      this.integral = this.maxIntegral;
    } else if (this.integral < -this.maxIntegral) {
      this.integral = -this.maxIntegral;
    }

    // 微分制御
    const derivative = (error - this.lastError) / timeChange;
    this.lastError = error;

    // PID出力計算
    let output = this.kp * error + this.ki * this.integral + this.kd * derivative;

    // 出力制限
    if (output > this.maxControlSpeed) {
      output = this.maxControlSpeed;
    } else if (output < -this.maxControlSpeed) {
      output = -this.maxControlSpeed;
    }

    return output;
  }

  public getDebugInfo() {
    return {
      error: this.lastError,
      p: this.kp * this.lastError,
      i: this.ki * this.integral,
      d: this.kd * ((this.lastError - this.lastError) / (Date.now() - this.lastTime)),
      output: this.lastError
    };
  }
}

export class PIDNPC implements NPCAlgorithm {
  private config: NPCConfig;
  private pidController: PIDController;
  private state: {
    rallyStartTime: number;
  };
  private pidDebugInfo: { error: number; p: number; i: number; d: number; output: number } | null = null;

  constructor(config: NPCConfig, _canvasWidth?: number) {
    this.config = config;
    this.state = {
      rallyStartTime: Date.now(),
    };

    const pidConfig = this.config.pid;
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
      this.config.pid = {
        ...this.config.pid,
        ...settings.pid
      };
    }

    if (config.pid) {
      this.pidController.updateGains(
        config.pid.kp || this.config.pid.kp,
        config.pid.ki || this.config.pid.ki,
        config.pid.kd || this.config.pid.kd,
        config.pid.maxIntegral || this.config.pid.maxIntegral,
        config.pid.derivativeFilter || this.config.pid.derivativeFilter,
        config.pid.maxControlSpeed || this.config.pid.maxControlSpeed
      );
    }
  }

  public calculateMovement(gameState: any, npcPaddle: { x: number; y: number; width: number; height: number }, _paddleSpeed?: number): { targetX: number; pidOutput: number } {
    const predictedBallX = this.predictBallIntersection(gameState, npcPaddle);
    const currentPaddleCenter = npcPaddle.x + npcPaddle.width / 2;

    const controlOutput = this.pidController.update(predictedBallX, currentPaddleCenter);
    this.pidDebugInfo = this.pidController.getDebugInfo();

    return {
      targetX: predictedBallX,
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
    return 0;
  }
}

// ファクトリーにアルゴリズムを登録
NPCFactory.registerAlgorithm('pid', PIDNPC);
