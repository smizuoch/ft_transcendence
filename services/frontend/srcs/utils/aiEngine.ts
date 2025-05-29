import { AIConfig, AIState, GameState, AIDebugInfo, DIFFICULTY_SETTINGS } from './aiTypes';

class PIDController {
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
  private prevOutput: number = 0; // 前回の出力値を保存
  private outputFilter: number = 0.15; // 出力フィルタ係数（より強いスムージング）
  private movingAverage: number[] = []; // 移動平均用
  private deadZone: number = 1.5; // デッドゾーンを小さく（反応性向上）

  constructor(kp: number, ki: number, kd: number, maxIntegral: number, derivativeFilter: number, maxControlSpeed: number) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.maxIntegral = maxIntegral;
    this.derivativeFilter = Math.max(0.1, Math.min(0.8, derivativeFilter)); // 範囲を調整
    this.maxControlSpeed = maxControlSpeed;
    this.lastUpdateTime = Date.now();
  }

  public update(target: number, current: number): number {
    const currentTime = Date.now();
    const dt = Math.max((currentTime - this.lastUpdateTime) / 1000, 1/120);
    this.lastUpdateTime = currentTime;

    const error = target - current;

    // デッドゾーンを小さくして反応性向上
    if (Math.abs(error) < this.deadZone) {
      return 0;
    }

    // 比例項
    const proportional = this.kp * error;

    // 積分項（制限を緩和）
    const integralDeadband = 5; // より小さく
    if (Math.abs(error) > integralDeadband) {
      this.integral += error * dt;
      this.integral = Math.max(-this.maxIntegral, Math.min(this.integral, this.maxIntegral));
      this.integral *= 0.998; // 減衰を緩和
    } else {
      this.integral *= 0.99; // より緩やかなリセット
    }
    const integralTerm = this.ki * this.integral;

    // 微分項（フィルタリング緩和）
    const rawDerivative = (error - this.prevError) / dt;
    const clampedDerivative = Math.max(-800, Math.min(rawDerivative, 800)); // 制限を緩和
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

export class AIEngine {
  private config: AIConfig;
  private state: {
    targetX: number;
    lastUpdateTime: number;
    delayedBallX: number;
    delayedBallY: number;
    currentState: AIState;
    stateStartTime: number;
    ballSpottedTime: number;
    targetPosition: number;
    isTrackingBall: boolean;
    lastBallDirection: { dx: number; dy: number };
    rallyStartTime: number;
  };
  private pidController: PIDController;
  private pidDebugInfo: { error: number; p: number; i: number; d: number; output: number } | null = null;

  constructor(config: AIConfig, canvasWidth: number) {
    this.config = { ...config };
    this.state = {
      targetX: canvasWidth / 2,
      lastUpdateTime: Date.now(),
      delayedBallX: canvasWidth / 2,
      delayedBallY: canvasWidth / 2,
      currentState: AIState.IDLE,
      stateStartTime: Date.now(),
      ballSpottedTime: 0,
      targetPosition: canvasWidth / 2,
      isTrackingBall: false,
      lastBallDirection: { dx: 0, dy: 0 },
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

  public updateConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.difficulty && config.difficulty !== 'Custom') {
      const settings = DIFFICULTY_SETTINGS[config.difficulty];
      this.config.returnRate = settings.returnRate;
      this.config.reactionDelayMs = settings.reactionDelayMs;
      this.config.maxSpeed = settings.maxSpeed;
      this.config.trackingNoise = settings.trackingNoise;
      this.config.trackingTimeout = settings.trackingTimeout;
      this.config.pid = { ...settings.pid };
    }
    
    if (config.pid || config.difficulty) {
      const pidConfig = this.config.pid;
      this.pidController.updateGains(
        pidConfig.kp,
        pidConfig.ki,
        pidConfig.kd,
        pidConfig.maxIntegral,
        pidConfig.derivativeFilter,
        pidConfig.maxControlSpeed
      );
    }
    
    if (config.mode === 'fsm') {
      this.state.currentState = AIState.IDLE;
      this.state.stateStartTime = Date.now();
      this.state.ballSpottedTime = 0;
    } else if (config.mode === 'pid') {
      this.pidController.reset();
      this.state.rallyStartTime = Date.now();
    }
  }

  public updatePaddle(gameState: GameState, paddleSpeed: number): void {
    if (!this.config.enabled) return;

    const aiPaddle = this.config.player === 1 ? gameState.paddle1 : gameState.paddle2;
    
    switch (this.config.mode) {
      case 'heuristic':
        this.updateHeuristicAI(gameState, aiPaddle, paddleSpeed);
        break;
      case 'fsm':
        this.updateFSMAI(gameState, aiPaddle, paddleSpeed);
        break;
      case 'pid':
        this.updatePIDAI(gameState, aiPaddle);
        break;
    }
  }

  private updateHeuristicAI(gameState: GameState, aiPaddle: { x: number; y: number; width: number; height: number }, paddleSpeed: number): void {
    const currentTime = Date.now();
    const deltaTime = currentTime - this.state.lastUpdateTime;
    
    if (deltaTime >= this.config.reactionDelay * 1000) {
      this.state.delayedBallX = gameState.ball.x + (Math.random() - 0.5) * this.config.positionNoise;
      this.state.delayedBallY = gameState.ball.y + (Math.random() - 0.5) * this.config.positionNoise;
      this.state.lastUpdateTime = currentTime;
    }
    
    const predictedX = this.predictBallIntersection(gameState, aiPaddle);
    
    const targetX = predictedX - aiPaddle.width / 2;
    
    const currentCenter = aiPaddle.x + aiPaddle.width / 2;
    const targetCenter = targetX + aiPaddle.width / 2;
    const error = targetCenter - currentCenter;
    const movement = error * this.config.followGain;
    
    const newX = Math.max(0, Math.min(
      aiPaddle.x + Math.sign(movement) * Math.min(Math.abs(movement), paddleSpeed),
      gameState.canvasWidth - aiPaddle.width
    ));
    
    aiPaddle.x = newX;
  }

  private updateFSMAI(gameState: GameState, aiPaddle: { x: number; y: number; width: number; height: number }, paddleSpeed: number): void {
    const currentTime = Date.now();
    const { ball } = gameState;
    
    const ballHeadingToAI = this.config.player === 1 ? ball.dy < 0 : ball.dy > 0;
    
    this.updateFSMTransitions(currentTime, ballHeadingToAI, gameState);
    this.executeFSMAction(aiPaddle, currentTime, gameState, paddleSpeed);
  }

  private updateFSMTransitions(currentTime: number, ballHeadingToAI: boolean, gameState: GameState): void {
    const timeInState = currentTime - this.state.stateStartTime;
    const epsilon = 1 - this.config.returnRate;
    const { ball } = gameState;
    
    const ballInCenterArea = Math.abs(ball.y - gameState.canvasHeight / 2) < gameState.canvasHeight * 0.3;
    
    switch (this.state.currentState) {
      case AIState.IDLE:
        if (ballHeadingToAI) {
          if (!this.state.ballSpottedTime) {
            this.state.ballSpottedTime = currentTime;
          }
          
          if (currentTime - this.state.ballSpottedTime >= this.config.reactionDelayMs) {
            this.transitionToState(AIState.TRACK, currentTime, gameState);
            this.state.rallyStartTime = currentTime;
          }
        } else if (!ballHeadingToAI) {
          this.state.ballSpottedTime = 0;
        }
        break;
        
      case AIState.TRACK:
        const missChance = epsilon * (1/60);
        if (Math.random() < missChance) {
          this.transitionToState(AIState.MISS, currentTime, gameState);
        }
        else if (timeInState > this.config.trackingTimeout) {
          this.transitionToState(AIState.IDLE, currentTime, gameState);
        }
        else if (!ballHeadingToAI && !ballInCenterArea) {
          this.transitionToState(AIState.IDLE, currentTime, gameState);
        }
        else if (Math.random() < 0.002 && this.config.difficulty === 'Hard') {
          this.transitionToState(AIState.SMASH, currentTime, gameState);
        }
        break;
        
      case AIState.MISS:
        if (!ballHeadingToAI || timeInState > 3000) {
          this.transitionToState(AIState.IDLE, currentTime, gameState);
        }
        break;
        
      case AIState.SMASH:
        if (timeInState > 300) {
          if (ballHeadingToAI) {
            this.transitionToState(AIState.TRACK, currentTime, gameState);
          } else {
            this.transitionToState(AIState.IDLE, currentTime, gameState);
          }
        }
        break;
        
      case AIState.EDGE_PLAY:
        if (timeInState > 1000) {
          this.transitionToState(AIState.IDLE, currentTime, gameState);
        }
        break;
    }
    
    this.state.isTrackingBall = ballHeadingToAI;
  }

  private transitionToState(newState: AIState, currentTime: number, gameState: GameState): void {
    this.state.currentState = newState;
    this.state.stateStartTime = currentTime;
    
    switch (newState) {
      case AIState.MISS:
        const canvasCenter = gameState.canvasWidth / 2;
        const missDistance = gameState.canvasWidth * 0.3;
        this.state.targetPosition = Math.random() > 0.5 
          ? canvasCenter + missDistance 
          : canvasCenter - missDistance;
        break;
      case AIState.TRACK:
      case AIState.SMASH:
        const aiPaddle = this.config.player === 1 ? gameState.paddle1 : gameState.paddle2;
        this.state.targetPosition = this.predictBallIntersection(gameState, aiPaddle);
        break;
    }
  }

  private executeFSMAction(aiPaddle: { x: number; y: number; width: number; height: number }, currentTime: number, gameState: GameState, paddleSpeed: number): void {
    let targetX: number;
    let moveSpeedMultiplier = 1.0;
    
    switch (this.state.currentState) {
      case AIState.IDLE:
        const centerX = gameState.canvasWidth / 2 - aiPaddle.width / 2;
        const idleNoise = Math.sin(currentTime * 0.003) * 8;
        targetX = centerX + idleNoise;
        moveSpeedMultiplier = 0.4;
        break;
        
      case AIState.TRACK:
        const predicted = this.predictBallIntersection(gameState, aiPaddle);
        const noise = (Math.random() - 0.5) * this.config.trackingNoise;
        targetX = predicted - aiPaddle.width / 2 + noise;
        moveSpeedMultiplier = this.config.maxSpeed;
        break;
        
      case AIState.MISS:
        targetX = this.state.targetPosition - aiPaddle.width / 2;
        moveSpeedMultiplier = 0.2;
        break;
        
      case AIState.SMASH:
        targetX = this.predictBallIntersection(gameState, aiPaddle) - aiPaddle.width / 2;
        moveSpeedMultiplier = 1.8;
        break;
        
      default:
        targetX = aiPaddle.x;
        moveSpeedMultiplier = 0;
    }
    
    this.movePaddleToTarget(aiPaddle, targetX, moveSpeedMultiplier, paddleSpeed, gameState.canvasWidth);
  }

  private updatePIDAI(gameState: GameState, aiPaddle: { x: number; y: number; width: number; height: number }): void {
    const predictedBallX = this.predictBallIntersection(gameState, aiPaddle);
    const ballHeadingToAI = this.config.player === 1 ? gameState.ball.dy < 0 : gameState.ball.dy > 0;
    
    let targetX: number;
    
    if (ballHeadingToAI && Math.abs(gameState.ball.dy) > 0.1) {
      // ボールが向かってくる時：強さを保ちつつノイズを調整
      const noise = (Math.random() - 0.5) * this.config.trackingNoise * 0.7; // 0.5から0.7に
      targetX = predictedBallX + noise;
      
      const rallyTime = (Date.now() - this.state.rallyStartTime) / 1000;
      const difficultyFactor = Math.max(0.4, 1.0 - Math.min(rallyTime / 25, 0.6)); // より強く
      
      const pidConfig = this.config.pid;
      this.pidController.updateGains(
        pidConfig.kp * difficultyFactor * 0.95, // 0.8から0.95に強化
        pidConfig.ki * 0.85, // 0.7から0.85に強化
        pidConfig.kd * difficultyFactor * 0.8, // 0.6から0.8に強化
        pidConfig.maxIntegral,
        Math.max(0.2, pidConfig.derivativeFilter), // 0.3から0.2に緩和
        pidConfig.maxControlSpeed * difficultyFactor * 0.85 // 0.7から0.85に強化
      );
    } else {
      // ボールが離れている時：中央復帰の速度を上げる
      targetX = gameState.canvasWidth / 2;
      
      const pidConfig = this.config.pid;
      this.pidController.updateGains(
        pidConfig.kp * 0.35, // 0.2から0.35に強化
        pidConfig.ki * 0.4,  // 0.3から0.4に強化
        pidConfig.kd * 0.3,  // 0.2から0.3に強化
        pidConfig.maxIntegral,
        0.7, // 0.8から0.7に緩和
        pidConfig.maxControlSpeed * 0.4 // 0.3から0.4に強化
      );
    }
    
    const currentPaddleCenter = aiPaddle.x + aiPaddle.width / 2;
    const targetPaddleCenter = targetX;
    
    const controlOutput = this.pidController.update(targetPaddleCenter, currentPaddleCenter);
    
    // 最終的な位置制限
    let newX = aiPaddle.x + controlOutput;
    
    const margin = 1; // マージンを2から1に縮小
    newX = Math.max(margin, Math.min(newX, gameState.canvasWidth - aiPaddle.width - margin));
    
    // 位置更新の閾値を下げる（反応性向上）
    if (Math.abs(newX - aiPaddle.x) > 0.15) { // 0.3から0.15に
      aiPaddle.x = newX;
    }
    
    this.pidDebugInfo = this.pidController.getDebugInfo();
  }

  private movePaddleToTarget(paddle: { x: number; width: number }, targetX: number, speedMultiplier: number, paddleSpeed: number, canvasWidth: number): void {
    const currentCenter = paddle.x + paddle.width / 2;
    const targetCenter = targetX + paddle.width / 2;
    const error = targetCenter - currentCenter;
    
    const maxSpeed = paddleSpeed * speedMultiplier;
    const movement = Math.sign(error) * Math.min(Math.abs(error), maxSpeed);
    
    const newX = Math.max(0, Math.min(
      paddle.x + movement,
      canvasWidth - paddle.width
    ));
    
    paddle.x = newX;
  }

  private predictBallIntersection(gameState: GameState, aiPaddle: { y: number }): number {
    const { ball } = gameState;
    
    const isMovingTowardsAI = this.config.player === 1 ? ball.dy < 0 : ball.dy > 0;
    if (!isMovingTowardsAI || Math.abs(ball.dy) < 0.1) {
      return ball.x;
    }
    
    let futureX = ball.x;
    let futureDX = ball.dx;
    const targetY = aiPaddle.y;
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

  public getDebugInfo(): AIDebugInfo {
    const baseInfo = {
      state: this.config.mode === 'pid' ? 'PID' : this.state.currentState,
      timeInState: Date.now() - this.state.stateStartTime,
      returnRate: this.config.returnRate,
      targetPosition: this.state.targetPosition,
    };
    
    if (this.config.mode === 'pid' && this.pidDebugInfo) {
      return { ...baseInfo, pid: this.pidDebugInfo };
    }
    
    return baseInfo;
  }
}
