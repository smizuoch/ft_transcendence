export class PIDController {
  private kp: number;
  private ki: number;
  private kd: number;
  private maxIntegral: number;
  private derivativeFilter: number;
  private maxControlSpeed: number;

  private integral: number = 0;
  private prevError: number = 0;
  private filteredDerivative: number = 0;
  private lastUpdateTime: number = 0;
  private prevOutput: number = 0;
  private outputFilter: number = 0.15;
  private movingAverage: number[] = [];
  private deadZone: number = 1.5;

  constructor(kp: number, ki: number, kd: number, maxIntegral: number, derivativeFilter: number, maxControlSpeed: number) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.maxIntegral = maxIntegral;
    this.derivativeFilter = Math.max(0.1, Math.min(0.8, derivativeFilter));
    this.maxControlSpeed = maxControlSpeed;
    this.lastUpdateTime = Date.now();
  }

  public update(target: number, current: number): number {
    const currentTime = Date.now();
    const dt = Math.max((currentTime - this.lastUpdateTime) / 1000, 1/120);
    this.lastUpdateTime = currentTime;

    const error = target - current;

    if (Math.abs(error) < this.deadZone) {
      return 0;
    }

    // 比例項
    const proportional = this.kp * error;

    // 積分項（制限を緩和）
    const integralDeadband = 5;
    if (Math.abs(error) > integralDeadband) {
      this.integral += error * dt;
      this.integral = Math.max(-this.maxIntegral, Math.min(this.integral, this.maxIntegral));
      this.integral *= 0.998;
    } else {
      this.integral *= 0.99;
    }
    const integralTerm = this.ki * this.integral;

    // 微分項（フィルタリング緩和）
    const rawDerivative = (error - this.prevError) / dt;
    const clampedDerivative = Math.max(-800, Math.min(rawDerivative, 800));
    this.filteredDerivative = this.derivativeFilter * this.filteredDerivative +
                             (1 - this.derivativeFilter) * clampedDerivative;
    const derivativeTerm = this.kd * this.filteredDerivative;

    this.prevError = error;

    // PID出力の計算
    let controlOutput = proportional + integralTerm + derivativeTerm;

    // 制御出力の制限
    controlOutput = Math.max(-this.maxControlSpeed * dt,
                           Math.min(controlOutput, this.maxControlSpeed * dt));

    // 移動平均を3フレームに短縮（反応性向上）
    this.movingAverage.push(controlOutput);
    if (this.movingAverage.length > 3) {
      this.movingAverage.shift();
    }
    const avgOutput = this.movingAverage.reduce((sum, val) => sum + val, 0) / this.movingAverage.length;

    // 出力スムージングを緩和（強さ優先）
    const smoothedOutput = this.outputFilter * this.prevOutput + (1 - this.outputFilter) * avgOutput;

    // 微小変化カットを緩和（0.2に変更）
    const outputDiff = smoothedOutput - this.prevOutput;
    let finalOutput = smoothedOutput;
    if (Math.abs(outputDiff) < 0.2) {
      finalOutput = this.prevOutput;
    }

    this.prevOutput = finalOutput;
    return finalOutput;
  }

  public updateGains(kp: number, ki: number, kd: number, maxIntegral: number, derivativeFilter: number, maxControlSpeed: number): void {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.maxIntegral = maxIntegral;
    this.derivativeFilter = derivativeFilter;
    this.maxControlSpeed = maxControlSpeed;
  }

  public reset(): void {
    this.integral = 0;
    this.prevError = 0;
    this.filteredDerivative = 0;
    this.prevOutput = 0;
    this.movingAverage = [];
    this.lastUpdateTime = Date.now();
  }

  public getDebugInfo(): { error: number; p: number; i: number; d: number; output: number } {
    const error = this.prevError;
    return {
      error,
      p: this.kp * error,
      i: this.ki * this.integral,
      d: this.kd * this.filteredDerivative,
      output: this.kp * error + this.ki * this.integral + this.kd * this.filteredDerivative,
    };
  }
}
