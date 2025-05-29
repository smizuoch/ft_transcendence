import { NPCConfig, GameState } from './npcTypes';
import { NPCAlgorithm, NPCFactory } from './npcEngine';

export class HeuristicNPC implements NPCAlgorithm {
  private config: NPCConfig;
  private state: {
    delayedBallX: number;
    delayedBallY: number;
    lastUpdateTime: number;
  };

  constructor(config: NPCConfig) {
    this.config = config;
    this.state = {
      delayedBallX: 0,
      delayedBallY: 0,
      lastUpdateTime: Date.now(),
    };
  }

  public updateConfig(config: Partial<NPCConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public calculateMovement(gameState: GameState, npcPaddle: { x: number; y: number; width: number; height: number }, paddleSpeed: number = 5): { targetX: number; movement: number } {
    // 遅延処理とノイズの追加
    this.state.delayedBallX = gameState.ball.x + (Math.random() - 0.5) * this.config.positionNoise;
    this.state.delayedBallY = gameState.ball.y + (Math.random() - 0.5) * this.config.positionNoise;

    const predictedX = this.predictBallIntersection(gameState, npcPaddle);
    const targetX = predictedX - npcPaddle.width / 2;

    const currentCenter = npcPaddle.x + npcPaddle.width / 2;
    const targetCenter = targetX + npcPaddle.width / 2;
    const error = targetCenter - currentCenter;
    const movement = error * this.config.followGain;

    return {
      targetX,
      movement: Math.sign(movement) * Math.min(Math.abs(movement), paddleSpeed)
    };
  }

  private predictBallIntersection(gameState: GameState, npcPaddle: { y: number }): number {
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

  public getDebugInfo(): any {
    return {
      algorithm: 'heuristic',
      delayedBallX: this.state.delayedBallX,
      delayedBallY: this.state.delayedBallY,
    };
  }
}

// ファクトリーにアルゴリズムを登録
NPCFactory.registerAlgorithm('heuristic', HeuristicNPC);
