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

        // ゲームが終了した場合の処理
        if (!session.isRunning) {
          // GamePong42では終了したNPCは再起動しない（脱落）
          // ただし、5秒後にゲームを削除
          setTimeout(() => {
            this.games.delete(gameId);
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

    // パドルのNPC更新
    this.updateNPCPaddles(session, deltaTime);

    // ボールの位置更新
    const ball = session.gameState.ball;
    ball.x += ball.dx * deltaTime * 60;
    ball.y += ball.dy * deltaTime * 60;

    // 上下の壁との衝突（跳ね返り）
    if (ball.y <= ball.radius || ball.y >= session.gameState.canvasHeight - ball.radius) {
      ball.dy = -ball.dy;
      ball.y = ball.y <= ball.radius ? ball.radius : session.gameState.canvasHeight - ball.radius;
    }

    // パドルとの衝突判定
    this.checkPaddleCollisions(session);

    // 左右の壁との衝突（得点）
    if (ball.x <= ball.radius) {
      // Player2が得点
      session.score.player2++;

      // GamePong42ルール: Player2が得点してもゲーム継続（スコアリセット）
      session.score.player1 = 0;
      session.score.player2 = 0;
      this.resetGameBall(session, 'player2');
    } else if (ball.x >= session.gameState.canvasWidth - ball.radius) {
      // Player1が得点
      session.score.player1++;

      // GamePong42ルール: Player1が得点したら即座にゲーム終了
      console.log(`💀 Game Over - Player1 (upper NPC) scored, game terminated`);
      session.isRunning = false;
      return; // 以下の処理をスキップ
    }

    // Player2が得点した場合はゲーム継続のため、勝利条件チェックは不要
    // Player1が得点した場合は既にゲーム終了しているため、ここには到達しない
  }

  private checkPaddleCollisions(session: NPCGameSession): void {
    const gameState = session.gameState;
    const ball = gameState.ball;
    const paddle1 = gameState.paddle1;
    const paddle2 = gameState.paddle2;

    // Player1 (上のパドル) との衝突
    if (ball.dy < 0 && // ボールが上向きに移動している
        ball.y - ball.radius <= paddle1.y + paddle1.height &&
        ball.y - ball.radius >= paddle1.y &&
        ball.x >= paddle1.x &&
        ball.x <= paddle1.x + paddle1.width) {

      // 衝突反射
      ball.dy = -ball.dy;
      ball.y = paddle1.y + paddle1.height + ball.radius;

      // パドルの位置に基づく角度変更
      const hitPosition = (ball.x - (paddle1.x + paddle1.width / 2)) / (paddle1.width / 2);
      ball.dx += hitPosition * ball.speed * 0.3;

      gameState.paddleHits++;
    }

    // Player2 (下のパドル) との衝突
    if (ball.dy > 0 && // ボールが下向きに移動している
        ball.y + ball.radius >= paddle2.y &&
        ball.y + ball.radius <= paddle2.y + paddle2.height &&
        ball.x >= paddle2.x &&
        ball.x <= paddle2.x + paddle2.width) {

      // 衝突反射
      ball.dy = -ball.dy;
      ball.y = paddle2.y - ball.radius;

      // パドルの位置に基づく角度変更
      const hitPosition = (ball.x - (paddle2.x + paddle2.width / 2)) / (paddle2.width / 2);
      ball.dx += hitPosition * ball.speed * 0.3;

      gameState.paddleHits++;
    }

    // 速度制限を強化してより長いラリーを実現
    const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    const maxSpeed = Math.min(ball.speed * 2.0, session.config.maxBallSpeed || 6); // 最大2倍速まで & maxBallSpeed制限
    if (currentSpeed > maxSpeed) {
      const ratio = maxSpeed / currentSpeed;
      ball.dx *= ratio;
      ball.dy *= ratio;
    }
  }

  private updateNPCPaddles(session: NPCGameSession, deltaTime: number): void {
    const gameState = session.gameState;
    const ball = gameState.ball;

    // GamePong42仕様: より長いラリーを実現するためのバランス調整

    // Player1 (上のパドル) のNPC更新 - 意図的に弱くして得点しにくくする
    const paddle1CenterX = gameState.paddle1.x + gameState.paddle1.width / 2;
    const ballCenterX = ball.x;
    const paddle1Speed = 80 * deltaTime; // より遅い移動速度

    // Player1は意図的にミスしやすくする（反応が遅い）
    const paddle1Tolerance = 15; // 大きな許容範囲でミスを誘発
    if (Math.abs(ballCenterX - paddle1CenterX) > paddle1Tolerance) {
      // さらに遅い反応速度を追加
      const reactionDelay = Math.random() > 0.7 ? 0.5 : 1.0; // 30%の確率で反応が半分になる
      const actualSpeed = paddle1Speed * reactionDelay;

      if (ballCenterX > paddle1CenterX) {
        gameState.paddle1.x = Math.min(
          gameState.canvasWidth - gameState.paddle1.width,
          gameState.paddle1.x + actualSpeed
        );
      } else {
        gameState.paddle1.x = Math.max(0, gameState.paddle1.x - actualSpeed);
      }
    }

    // Player2 (下のパドル) のNPC更新 - より強くして長時間ラリーを続ける
    const paddle2CenterX = gameState.paddle2.x + gameState.paddle2.width / 2;
    const paddle2Speed = 140 * deltaTime; // 適度な速度

    const paddle2Tolerance = 8; // より正確な追跡
    if (Math.abs(ballCenterX - paddle2CenterX) > paddle2Tolerance) {
      if (ballCenterX > paddle2CenterX) {
        gameState.paddle2.x = Math.min(
          gameState.canvasWidth - gameState.paddle2.width,
          gameState.paddle2.x + paddle2Speed
        );
      } else {
        gameState.paddle2.x = Math.max(0, gameState.paddle2.x - paddle2Speed);
      }
    }
  }

  private resetGameBall(session: NPCGameSession, lastScorer?: 'player1' | 'player2'): void {
    const ball = session.gameState.ball;
    ball.x = session.gameState.canvasWidth / 2;
    ball.y = session.gameState.canvasHeight / 2;

    // GamePong42仕様: より長いラリーのためのボール射出角度調整
    // より水平に近い角度でボールを射出して、急激な得点を防ぐ
    const angle = (Math.random() * 0.1 + 0.05) * Math.PI; // より浅い角度 (9°-18°)
    const direction = Math.random() > 0.5 ? 1 : -1;
    const verticalDirection = Math.random() > 0.5 ? 1 : -1;

    // ボール速度も少し遅くして、NPCが反応しやすくする
    const ballSpeed = ball.speed * 0.8; // 20%速度減少
    ball.dx = ballSpeed * Math.sin(angle) * direction;
    ball.dy = ballSpeed * Math.cos(angle) * verticalDirection;
    ball.speedMultiplier = 1;
    session.gameState.paddleHits = 0;
  }

  public createGame(config: Partial<GameConfig> = {}): string {
    const gameId = this.generateGameId();
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    // キャンバスサイズを設定から取得（デフォルトは400x600）
    const canvasWidth = (config as any).canvasWidth || 400;
    const canvasHeight = (config as any).canvasHeight || 600;

    const session: NPCGameSession = {
      id: gameId,
      gameState: this.createInitialGameState(canvasWidth, canvasHeight, fullConfig),
      config: fullConfig,
      score: { player1: 0, player2: 0 },
      isRunning: true,
      lastUpdate: Date.now(),
      sessionType: 'npc_vs_npc'
    };

    this.games.set(gameId, session);
    return gameId;
  }

  private createInitialGameState(canvasWidth: number, canvasHeight: number, config: GameConfig) {
    // 比率から実際のサイズを計算
    const ballRadius = canvasWidth * config.ballRadiusRatio;
    const paddleWidth = canvasWidth * config.paddleWidthRatio;
    const paddleHeight = canvasHeight * config.paddleHeightRatio;

    return {
      ball: {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        dx: config.initialBallSpeed * (Math.random() > 0.5 ? 1 : -1),
        dy: config.initialBallSpeed * (Math.random() > 0.5 ? 1 : -1),
        radius: ballRadius,
        speed: config.initialBallSpeed,
        speedMultiplier: 1,
      },
      paddle1: {
        x: canvasWidth / 2 - paddleWidth / 2,
        y: 2, // 上端から2ピクセルの位置に移動
        width: paddleWidth,
        height: paddleHeight,
      },
      paddle2: {
        x: canvasWidth / 2 - paddleWidth / 2,
        y: canvasHeight - 2 - paddleHeight, // 下端から2ピクセルの位置に移動
        width: paddleWidth,
        height: paddleHeight,
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
      // GamePong42ルール: Player1が得点したら終了
      // Player1が得点した場合のみゲーム終了するため、常にplayer1が勝者
      response.winner = 'player1';
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

  public applySpeedBoostToGame(gameId: string): boolean {
    const session = this.games.get(gameId);
    if (!session || !session.isRunning) {
      return false;
    }

    // スピードブーストを適用
    session.gameState.ball.speedMultiplier *= 1.5;
    session.gameState.ball.dx *= 1.5;
    session.gameState.ball.dy *= 1.5;

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
