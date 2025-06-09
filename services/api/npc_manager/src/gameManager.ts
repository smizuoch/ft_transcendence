import { NPCGameSession, GameConfig, DEFAULT_CONFIG, NPCGameResponse } from './types';

export class NPCGameManager {
  private games: Map<string, NPCGameSession> = new Map();
  private updateInterval: any = null;
  private readonly UPDATE_RATE = 60; // 60 FPS

  constructor() {
    this.startUpdateLoop();
  }

  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      this.updateAllGames();
    }, 1000 / this.UPDATE_RATE);
  }

  private updateAllGames(): void {
    for (const [gameId, session] of this.games.entries()) {
      if (session.isRunning) {
        this.updateGameSession(session);

        // ゲームが終了した場合、一定時間後に削除
        if (!session.isRunning) {
          console.log(`🏁 Game ${gameId} finished, scheduling deletion in 5s`);
          setTimeout(() => {
            this.games.delete(gameId);
            console.log(`🗑️ Game ${gameId} deleted, remaining games: ${this.games.size}`);
          }, 5000); // 5秒後に削除
        }
      }
    }
  }

  private updateGameSession(session: NPCGameSession): void {
    // 簡単なゲーム更新ロジック
    const currentTime = Date.now();
    const deltaTime = (currentTime - session.lastUpdate) / 1000;
    session.lastUpdate = currentTime;

    // ボールの位置更新
    const ball = session.gameState.ball;
    ball.x += ball.dx * deltaTime * 60;
    ball.y += ball.dy * deltaTime * 60;

    // 上下の壁との衝突（跳ね返り）
    if (ball.y <= ball.radius || ball.y >= session.gameState.canvasHeight - ball.radius) {
      ball.dy = -ball.dy;
      ball.y = ball.y <= ball.radius ? ball.radius : session.gameState.canvasHeight - ball.radius;
    }

    // 左右の壁との衝突（得点）
    if (ball.x <= ball.radius) {
      // Player2が得点
      session.score.player2++;
      console.log(`🏓 Player2 scored! Score: ${session.score.player1}-${session.score.player2}`);
      this.resetGameBall(session, 'player2');
    } else if (ball.x >= session.gameState.canvasWidth - ball.radius) {
      // Player1が得点
      session.score.player1++;
      console.log(`🏓 Player1 scored! Score: ${session.score.player1}-${session.score.player2}`);
      this.resetGameBall(session, 'player1');
    }

    // 勝利条件をチェック
    if (session.score.player1 >= session.config.winningScore) {
      console.log(`🏆 Player1 wins! Final score: ${session.score.player1}-${session.score.player2}`);
      session.isRunning = false;
    } else if (session.score.player2 >= session.config.winningScore) {
      console.log(`🏆 Player2 wins! Final score: ${session.score.player1}-${session.score.player2}`);
      session.isRunning = false;
    }
  }

  private resetGameBall(session: NPCGameSession, lastScorer?: 'player1' | 'player2'): void {
    const ball = session.gameState.ball;
    ball.x = session.gameState.canvasWidth / 2;
    ball.y = session.gameState.canvasHeight / 2;

    // ランダムな方向でボール射出
    const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const verticalDirection = Math.random() > 0.5 ? 1 : -1;

    ball.dx = ball.speed * Math.sin(angle) * direction;
    ball.dy = ball.speed * Math.cos(angle) * verticalDirection;
    ball.speedMultiplier = 1;
    session.gameState.paddleHits = 0;
  }

  public createGame(config: Partial<GameConfig> = {}): string {
    const gameId = this.generateGameId();
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    const session: NPCGameSession = {
      id: gameId,
      gameState: this.createInitialGameState(400, 600, fullConfig),
      config: fullConfig,
      score: { player1: 0, player2: 0 },
      isRunning: true,
      lastUpdate: Date.now(),
      sessionType: 'npc_vs_npc'
    };

    this.games.set(gameId, session);
    console.log(`✅ Game created: ${gameId}, Total games: ${this.games.size}, Active: ${this.getActiveGameCount()}`);
    return gameId;
  }

  private createInitialGameState(canvasWidth: number, canvasHeight: number, config: GameConfig) {
    return {
      ball: {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        dx: config.initialBallSpeed * (Math.random() > 0.5 ? 1 : -1),
        dy: config.initialBallSpeed * (Math.random() > 0.5 ? 1 : -1),
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
  }

  public getGameState(gameId: string): NPCGameResponse | null {
    const session = this.games.get(gameId);
    if (!session) {
      return null;
    }

    const response: NPCGameResponse = {
      gameId: session.id,
      gameState: session.gameState,
      score: session.score,
      isRunning: session.isRunning,
    };

    if (!session.isRunning) {
      // 正しい勝者を決定
      if (session.score.player1 >= session.config.winningScore) {
        response.winner = 'player1';
      } else if (session.score.player2 >= session.config.winningScore) {
        response.winner = 'player2';
      }
    }

    return response;
  }

  public getAllActiveGames(): NPCGameResponse[] {
    const activeGames: NPCGameResponse[] = [];

    for (const session of this.games.values()) {
      if (session.isRunning) {
        activeGames.push({
          gameId: session.id,
          gameState: session.gameState,
          score: session.score,
          isRunning: session.isRunning,
        });
      }
    }

    return activeGames;
  }

  public applySpeedBoostToRandomGame(excludeGameId?: string): boolean {
    const activeGames = Array.from(this.games.values()).filter(
      game => game.isRunning && game.id !== excludeGameId
    );

    if (activeGames.length === 0) {
      return false;
    }

    const randomGame = activeGames[Math.floor(Math.random() * activeGames.length)];

    // スピードブーストを適用
    randomGame.gameState.ball.speedMultiplier *= 1.2;
    randomGame.gameState.ball.dx *= 1.2;
    randomGame.gameState.ball.dy *= 1.2;

    return true;
  }

  public stopGame(gameId: string): boolean {
    const session = this.games.get(gameId);
    if (!session) {
      return false;
    }

    session.isRunning = false;
    return true;
  }

  public getGameCount(): number {
    return this.games.size;
  }

  public getActiveGameCount(): number {
    return Array.from(this.games.values()).filter(game => game.isRunning).length;
  }

  private generateGameId(): string {
    return 'npc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  public shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.games.clear();
  }
}
