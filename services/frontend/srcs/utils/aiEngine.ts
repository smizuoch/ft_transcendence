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
  
  // AI処理頻度制限用
  private lastAIUpdateTime: number = 0;
  private aiUpdateInterval: number = 1000; // 1秒間隔（1000ms）
  private lastAIDecision: {
    targetX: number;
    movement: number;
    pidOutput: number;
  } = { targetX: 0, movement: 0, pidOutput: 0 };

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

    const currentTime = Date.now();
    const aiPaddle = this.config.player === 1 ? gameState.paddle1 : gameState.paddle2;
    
    // AI判断を1秒間に1回に制限
    if (currentTime - this.lastAIUpdateTime >= this.aiUpdateInterval) {
      this.lastAIUpdateTime = currentTime;
      
      // AI判断を実行して結果を保存
      switch (this.config.mode) {
        case 'heuristic':
          this.calculateHeuristicDecision(gameState, aiPaddle, paddleSpeed);
          break;
        case 'fsm':
          this.calculateFSMDecision(gameState, aiPaddle, paddleSpeed);
          break;
        case 'pid':
          this.calculatePIDDecision(gameState, aiPaddle);
          break;
      }
    }
    
    // 保存された判断結果を適用
    this.applyAIDecision(aiPaddle, gameState.canvasWidth);
  }

  private calculateHeuristicDecision(gameState: GameState, aiPaddle: { x: number; y: number; width: number; height: number }, paddleSpeed: number): void {
    // 遅延処理は既にaiUpdateIntervalで制御されているため、毎回最新の情報を使用
    this.state.delayedBallX = gameState.ball.x + (Math.random() - 0.5) * this.config.positionNoise;
    this.state.delayedBallY = gameState.ball.y + (Math.random() - 0.5) * this.config.positionNoise;
    
    const predictedX = this.predictBallIntersection(gameState, aiPaddle);
    const targetX = predictedX - aiPaddle.width / 2;
    
    const currentCenter = aiPaddle.x + aiPaddle.width / 2;
    const targetCenter = targetX + aiPaddle.width / 2;
    const error = targetCenter - currentCenter;
    const movement = error * this.config.followGain;
    
    this.lastAIDecision.targetX = targetX;
    this.lastAIDecision.movement = Math.sign(movement) * Math.min(Math.abs(movement), paddleSpeed);
  }

  private calculateFSMDecision(gameState: GameState, aiPaddle: { x: number; y: number; width: number; height: number }, paddleSpeed: number): void {
    const currentTime = Date.now();
    const { ball } = gameState;
    const ballHeadingToAI = this.config.player === 1 ? ball.dy < 0 : ball.dy > 0;
    
    this.updateFSMTransitions(currentTime, ballHeadingToAI, gameState);
    
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
    
    const currentCenter = aiPaddle.x + aiPaddle.width / 2;
    const targetCenter = targetX + aiPaddle.width / 2;
    const error = targetCenter - currentCenter;
    const maxSpeed = paddleSpeed * moveSpeedMultiplier;
    const movement = Math.sign(error) * Math.min(Math.abs(error), maxSpeed);
    
    this.lastAIDecision.targetX = targetX;
    this.lastAIDecision.movement = movement;
  }

  private calculatePIDDecision(gameState: GameState, aiPaddle: { x: number; y: number; width: number; height: number }): void {
    const predictedBallX = this.predictBallIntersection(gameState, aiPaddle);
    const ballHeadingToAI = this.config.player === 1 ? gameState.ball.dy < 0 : gameState.ball.dy > 0;
    
    let targetX: number;
    
    if (ballHeadingToAI && Math.abs(gameState.ball.dy) > 0.1) {
      const noise = (Math.random() - 0.5) * this.config.trackingNoise * 0.7;
      targetX = predictedBallX + noise;
      
      const rallyTime = (Date.now() - this.state.rallyStartTime) / 1000;
      const difficultyFactor = Math.max(0.4, 1.0 - Math.min(rallyTime / 25, 0.6));
      
      const pidConfig = this.config.pid;
      this.pidController.updateGains(
        pidConfig.kp * difficultyFactor * 0.95,
        pidConfig.ki * 0.85,
        pidConfig.kd * difficultyFactor * 0.8,
        pidConfig.maxIntegral,
        Math.max(0.2, pidConfig.derivativeFilter),
        pidConfig.maxControlSpeed * difficultyFactor * 0.85
      );
    } else {
      targetX = gameState.canvasWidth / 2;
      
      const pidConfig = this.config.pid;
      this.pidController.updateGains(
        pidConfig.kp * 0.35,
        pidConfig.ki * 0.4,
        pidConfig.kd * 0.3,
        pidConfig.maxIntegral,
        0.7,
        pidConfig.maxControlSpeed * 0.4
      );
    }
    
    const currentPaddleCenter = aiPaddle.x + aiPaddle.width / 2;
    const targetPaddleCenter = targetX;
    
    const controlOutput = this.pidController.update(targetPaddleCenter, currentPaddleCenter);
    
    this.lastAIDecision.targetX = targetX;
    this.lastAIDecision.pidOutput = controlOutput;
    this.pidDebugInfo = this.pidController.getDebugInfo();
  }

  private applyAIDecision(aiPaddle: { x: number; width: number }, canvasWidth: number): void {
    let newX: number;
    
    if (this.config.mode === 'pid') {
      // PIDモードの場合
      newX = aiPaddle.x + this.lastAIDecision.pidOutput;
      const margin = 1;
      newX = Math.max(margin, Math.min(newX, canvasWidth - aiPaddle.width - margin));
      
      if (Math.abs(newX - aiPaddle.x) > 0.15) {
        aiPaddle.x = newX;
      }
    } else {
      // HeuristicとFSMモードの場合
      newX = Math.max(0, Math.min(
        aiPaddle.x + this.lastAIDecision.movement,
        canvasWidth - aiPaddle.width
      ));
      
      aiPaddle.x = newX;
    }
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
