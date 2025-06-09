export class PIDController {
  private kp: number;
  private ki: number;
  private kd: number;
  private maxIntegral: number;
  private derivativeFilter: number;
  private maxControlSpeed: number;

  private integral: number = 0;
  private lastError: number = 0;
  private lastDerivative: number = 0;
  private lastTime: number = 0;

  constructor(
    kp: number,
    ki: number,
    kd: number,
    maxIntegral: number = 100,
    derivativeFilter: number = 0.1,
    maxControlSpeed: number = 500
  ) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.maxIntegral = maxIntegral;
    this.derivativeFilter = derivativeFilter;
    this.maxControlSpeed = maxControlSpeed;
  }

  public update(setpoint: number, processVariable: number, deltaTime: number): number {
    if (deltaTime <= 0) return 0;

    const error = setpoint - processVariable;

    // 積分項の計算（アンチワインドアップ付き）
    this.integral += error * deltaTime;
    this.integral = Math.max(-this.maxIntegral, Math.min(this.maxIntegral, this.integral));

    // 微分項の計算（フィルタリング付き）
    const derivative = (error - this.lastError) / deltaTime;
    this.lastDerivative = this.lastDerivative * (1 - this.derivativeFilter) +
                         derivative * this.derivativeFilter;

    // PID出力計算
    const output = this.kp * error + this.ki * this.integral + this.kd * this.lastDerivative;

    // 出力制限
    const limitedOutput = Math.max(-this.maxControlSpeed, Math.min(this.maxControlSpeed, output));

    this.lastError = error;
    this.lastTime = Date.now();

    return limitedOutput;
  }

  public reset(): void {
    this.integral = 0;
    this.lastError = 0;
    this.lastDerivative = 0;
    this.lastTime = 0;
  }

  public getDebugInfo(error: number, output: number) {
    return {
      error,
      p: this.kp * error,
      i: this.ki * this.integral,
      d: this.kd * this.lastDerivative,
      output,
    };
  }
}
