import { NPCEngine } from './npcEngine';
import { NPCConfig, DEFAULT_NPC_CONFIG } from './npcTypes';
import type { GameState, NPCDebugInfo } from './npcTypes';
import { DIFFICULTY_SETTINGS } from './npcTypes';

// デバッグモードの設定
const isDebugMode = !!(
  (import.meta.env as any).DEV || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
  (typeof window !== 'undefined' && localStorage.getItem('debug') === 'true')
);

// デバッグログ関数
const debugLog = (...args: any[]) => {
  if (isDebugMode) {
    console.log('[GameEngine]', ...args);
  }
};

export interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  speed: number;
  speedMultiplier: number;
}

export interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameConfig {
  winningScore: number;
  maxBallSpeed: number;
  paddleSpeed: number;
  ballRadius: number;
  paddleWidth: number;
  paddleHeight: number;
  initialBallSpeed: number;
  npc: NPCConfig;
}

export const DEFAULT_CONFIG: GameConfig = {
  winningScore: 11,
  maxBallSpeed: 12,
  paddleSpeed: 8,
  ballRadius: 8,
  paddleWidth: 80,
  paddleHeight: 12,
  initialBallSpeed: 4,
  npc: DEFAULT_NPC_CONFIG,
};

export class GameEngine {
  private state: GameState;
  private config: GameConfig;
  private npcEngine: NPCEngine | null = null;
  private npcEngine2: NPCEngine | null = null;

  // ゲーム状態管理
  private score: { player1: number; player2: number } = { player1: 0, player2: 0 };
  private gameStarted: boolean = false;
  private gameOver: boolean = false;
  private winner: number | null = null;

  // マルチプレイヤー用の状態管理
  private isAuthoritativeClient: boolean = false;
  private gameStateUpdateCallback: ((gameState: GameState) => void) | null = null;
  private scoreUpdateCallback: ((scorer: 'player1' | 'player2') => void) | null = null;

  // パドルの速度追跡用
  private paddleVelocity = {
    paddle1: { x: 0, prevX: 0, lastUpdateTime: 0 },
    paddle2: { x: 0, prevX: 0, lastUpdateTime: 0 }
  };

  // 攻撃システム用
  private attackEffect = {
    speedBoost: 1.0, // ボール速度倍率
    isActive: false, // 攻撃効果が有効かどうか
  };

  constructor(canvasWidth: number, canvasHeight: number, config: GameConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.state = {
      ball: {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        dx: 0,
        dy: 0,
        vx: 0, // multiplayerService.tsとの互換性のため
        vy: 0, // multiplayerService.tsとの互換性のため
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

      // multiplayerService.tsとの互換性のため
      players: {
        player1: {
          x: canvasWidth / 2 - config.paddleWidth / 2,
          y: 20,
        },
        player2: {
          x: canvasWidth / 2 - config.paddleWidth / 2,
          y: canvasHeight - 20 - config.paddleHeight,
        },
      },
      score: { player1: 0, player2: 0 },
      gameStarted: false,
      gameOver: false,
      winner: null,
      timestamp: Date.now(),
    };

    this.resetBall();
  }

  public getState(): GameState {
    return this.state;
  }

  public updateCanvasSize(width: number, height: number): void {
    this.state.canvasWidth = width;
    this.state.canvasHeight = height;
    this.initializePositions();
  }

  public setKeyState(): void {
    // キー状態は直接パドル更新で処理
  }

  public resetBall(lastScorer?: 'player1' | 'player2'): void {
    const { canvasWidth, canvasHeight } = this.state;
    this.state.ball.x = canvasWidth / 2;
    this.state.ball.y = canvasHeight / 2;

    // 得点者の方向にボールを射出するか、ランダム（ゲーム開始時）
    const angle = (Math.random() * 0.167 + 0.083) * Math.PI;
    const h = Math.random() > 0.5 ? 1 : -1;

    let verticalDirection: number;

    // NPCが有効な場合は常にプレイヤー側にボールを向ける
    if (this.npcEngine && this.config.npc.enabled) {
      // NPCがPlayer1の場合はPlayer2（下）にボールを向ける
      // NPCがPlayer2の場合はPlayer1（上）にボールを向ける
      verticalDirection = this.config.npc.player === 1 ? 1 : -1;
    } else {
      // NPC無効時の従来のロジック
      if (lastScorer) {
        // 得点者の方向にボールを射出
        verticalDirection = lastScorer === 'player1' ? -1 : 1; // player1が得点 → 上方向(-1), player2が得点 → 下方向(1)
      } else {
        // ゲーム開始時やリセット時はランダム
        verticalDirection = Math.random() > 0.5 ? 1 : -1;
      }
    }

    this.state.ball.dy = this.state.ball.speed * Math.cos(angle) * verticalDirection;
    this.state.ball.dx = this.state.ball.speed * Math.sin(angle) * h;
    this.state.ball.vy = this.state.ball.dy; // vyも設定
    this.state.ball.vx = this.state.ball.dx; // vxも設定
    this.state.ball.speedMultiplier = 1;
    this.state.paddleHits = 0;
  }

  private initializePositions(): void {
    const { canvasWidth, canvasHeight } = this.state;
    this.state.ball.x = canvasWidth / 2;
    this.state.ball.y = canvasHeight / 2;
    this.state.paddle1.x = canvasWidth / 2 - this.state.paddle1.width / 2;
    this.state.paddle1.y = 20;
    this.state.paddle2.x = canvasWidth / 2 - this.state.paddle2.width / 2;
    this.state.paddle2.y = canvasHeight - 20 - this.state.paddle2.height;
  }

  public update(): 'none' | 'player1' | 'player2' {
    // パドル速度を更新
    this.updatePaddleVelocities();

    // NPC更新（Player1用）
    if (this.npcEngine) {
      this.npcEngine.updatePaddle(this.getGameState(), this.config.paddleSpeed);
    }

    // NPC更新（Player2用）
    if (this.npcEngine2) {
      this.npcEngine2.updatePaddle(this.getGameState(), this.config.paddleSpeed);
    }

    this.updatePaddles();

    // ボールの更新（権威クライアントまたはローカルゲームのみ）
    if (this.isAuthoritativeClient || !this.gameStateUpdateCallback) {
      this.updateBall();
    }

    const result = this.checkGoals();

    // 権威クライアントのみゲーム状態を送信
    if (this.isAuthoritativeClient && this.gameStateUpdateCallback) {
      this.gameStateUpdateCallback(this.getGameState());
    }

    return result;
  }

  private updatePaddleVelocities(): void {
    const currentTime = Date.now();
    const dt = Math.max((currentTime - this.paddleVelocity.paddle1.lastUpdateTime) / 1000, 1/60);

    // Paddle1の速度計算
    const paddle1DeltaX = this.state.paddle1.x - this.paddleVelocity.paddle1.prevX;
    this.paddleVelocity.paddle1.x = paddle1DeltaX / dt;
    this.paddleVelocity.paddle1.prevX = this.state.paddle1.x;
    this.paddleVelocity.paddle1.lastUpdateTime = currentTime;

    // Paddle2の速度計算
    const paddle2DeltaX = this.state.paddle2.x - this.paddleVelocity.paddle2.prevX;
    this.paddleVelocity.paddle2.x = paddle2DeltaX / dt;
    this.paddleVelocity.paddle2.prevX = this.state.paddle2.x;
    this.paddleVelocity.paddle2.lastUpdateTime = currentTime;
  }

  private updatePaddles(): void {
    // キーボード制御のみ（AIは別途処理済み）
    // キーボード制御は gameHooks で処理
  }

  // ボール攻撃システム
  public applySpeedAttack(speedMultiplier: number = 2.0): void {
    this.attackEffect.speedBoost = speedMultiplier;
    this.attackEffect.isActive = true;
  }

  public clearAttackEffect(): void {
    this.attackEffect.speedBoost = 1.0;
    this.attackEffect.isActive = false;
  }

  public getAttackEffect(): { speedBoost: number; isActive: boolean } {
    return {
      speedBoost: this.attackEffect.isActive ? this.attackEffect.speedBoost : 1.0,
      isActive: this.attackEffect.isActive,
    };
  }

  private updateBall(): void {
    const { ball, canvasWidth } = this.state;

    // 攻撃効果を適用
    const attackEffect = this.getAttackEffect();
    const effectiveSpeedMultiplier = ball.speedMultiplier * attackEffect.speedBoost;

    const currentSpeed = Math.hypot(ball.dx, ball.dy) || 1;
    const maxSpeed = Math.min(effectiveSpeedMultiplier, this.config.maxBallSpeed / ball.speed);
    ball.dx = (ball.dx / currentSpeed) * ball.speed * maxSpeed;
    ball.dy = (ball.dy / currentSpeed) * ball.speed * maxSpeed;

    // vx, vyも同期
    ball.vx = ball.dx;
    ball.vy = ball.dy;

    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvasWidth) {
      ball.dx *= -1;
      ball.vx = ball.dx; // vxも更新
      ball.x = Math.max(ball.radius, Math.min(ball.x, canvasWidth - ball.radius));
    }

    this.checkPaddleCollision();
  }

  private checkPaddleCollision(): void {
    const { paddle1, paddle2 } = this.state;

    if (this.isColliding(paddle1, true)) {
      this.reflectBall(paddle1, true);
    } else if (this.isColliding(paddle2, false)) {
      this.reflectBall(paddle2, false);
    }
  }

  private isColliding(paddle: Paddle, isTop: boolean): boolean {
    const { ball } = this.state;
    const xOverlap = ball.x + ball.radius > paddle.x && ball.x - ball.radius < paddle.x + paddle.width;
    const yOverlap = isTop
      ? ball.y - ball.radius < paddle.y + paddle.height && ball.y + ball.radius > paddle.y
      : ball.y + ball.radius > paddle.y && ball.y - ball.radius < paddle.y + paddle.height;
    return xOverlap && yOverlap;
  }

  private reflectBall(paddle: Paddle, isTop: boolean): void {
    const { ball } = this.state;

    // 【シンプルな角度決定システム（接触位置のみ）】
    // パドル上での接触位置を計算（-1.0 ～ +1.0の範囲）
    const hitPosition = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);

    // 接触位置を角度に変換（最大60度まで）
    const reflectionAngle = hitPosition * (Math.PI / 3); // Math.PI/3 = 60度

    // 現在のボール速度を保持
    const speed = Math.hypot(ball.dx, ball.dy);

    if (isTop) {
      // 上側パドル（Player1）との接触
      ball.dx = Math.sin(reflectionAngle) * speed; // 水平成分
      ball.dy = Math.abs(Math.cos(reflectionAngle) * speed); // 垂直成分（下向き）
      ball.vx = ball.dx; // vxも更新
      ball.vy = ball.dy; // vyも更新
      ball.y = paddle.y + paddle.height + ball.radius;
    } else {
      // 下側パドル（Player2）との接触
      ball.dx = Math.sin(Math.PI - reflectionAngle) * speed; // 水平成分（反転）
      ball.dy = -Math.abs(Math.cos(reflectionAngle) * speed); // 垂直成分（上向き）
      ball.vx = ball.dx; // vxも更新
      ball.vy = ball.dy; // vyも更新
      ball.y = paddle.y - ball.radius;
    }

    // NPCの技効果をリセット（使用後クリア）
    if (this.npcEngine) {
      this.npcEngine.resetTechniqueEffect();
    }

    // 【速度増加システム】
    this.state.paddleHits += 1;
    ball.speedMultiplier = Math.min(1 + this.state.paddleHits * 0.15, 6); // 最大6倍まで加速
  }

  private checkGoals(): 'none' | 'player1' | 'player2' {
    const { ball } = this.state;

    if (ball.y - ball.radius < 0) {
      // Player2が得点
      if (this.attackEffect.isActive) {
        this.clearAttackEffect();
      }

      // スコア更新
      this.score.player2++;
      this.state.score.player2++;
      debugLog('Player2 scored! New score:', this.score);

      this.resetBall('player2');

      // マルチプレイヤー時: 権威クライアントのみスコア更新を送信
      if (this.isAuthoritativeClient && this.scoreUpdateCallback) {
        this.scoreUpdateCallback('player2');
      }

      return 'player2';
    } else if (ball.y + ball.radius > this.state.canvasHeight) {
      // Player1が得点
      this.score.player1++;
      this.state.score.player1++;
      debugLog('Player1 scored! New score:', this.score);

      this.resetBall('player1');

      // マルチプレイヤー時: 権威クライアントのみスコア更新を送信
      if (this.isAuthoritativeClient && this.scoreUpdateCallback) {
        this.scoreUpdateCallback('player1');
      }

      return 'player1';
    }

    return 'none';
  }

  // Player2用のNPC設定を追加
  public updateNPCConfig2(config: Partial<NPCConfig>): void {
    if (!this.npcEngine2) {
      this.npcEngine2 = new NPCEngine({
        ...config,
        player: 2 as 1 | 2, // Player2に固定
      } as NPCConfig, this.state.canvasWidth);
    } else {
      this.npcEngine2.updateConfig({
        ...config,
        player: 2 as 1 | 2,
      });
    }
  }

  public updateNPCConfig(config: Partial<NPCConfig>): void {
    this.config.npc = { ...this.config.npc, ...config };

    // NPCが無効になった場合は、NPCエンジンを完全に削除
    if (config.enabled === false) {
      this.npcEngine = null;
      return;
    }

    // NPCが有効で、modeが指定されている場合のみ、以下の処理を実行
    if (config.enabled === true && config.mode) {
      // 難易度設定の自動適用
      if (config.difficulty && config.difficulty !== 'Custom') {
        const settings = DIFFICULTY_SETTINGS[config.difficulty];
        if (config.mode === 'technician' && settings.technician) {
          this.config.npc.technician = { ...this.config.npc.technician, ...settings.technician };
        }
        if (config.mode === 'pid' && settings.pid) {
          this.config.npc.pid = { ...this.config.npc.pid, ...settings.pid };
        }
      }

      if (!this.npcEngine) {
        this.npcEngine = new NPCEngine(config as NPCConfig, this.state.canvasWidth);
      } else {
        this.npcEngine.updateConfig(config);
      }

      // 中央キャンバス用：Player2は自動NPC設定しない（プレイヤー制御）
      // ミニゲームでのみPlayer2にPIDNPCを設定
      if (this.state.canvasWidth === 100 && this.state.canvasHeight === 100) {
        // ミニゲーム判定：小さいキャンバスサイズの場合のみPlayer2にNPC設定
        this.updateNPCConfig2({
          mode: 'pid' as any,
          enabled: true,
          difficulty: 'Nightmare' as any, // Hard → Nightmareに変更（最強）
        });
      }
    }
  }

  public getNPCDebugInfo(): NPCDebugInfo | null {
    if (!this.npcEngine) return null;
    return this.npcEngine.getDebugInfo();
  }

  public getGameState(): GameState {
    return {
      ball: {
        ...this.state.ball,
        vx: this.state.ball.dx, // multiplayerService.tsとの互換性のため
        vy: this.state.ball.dy, // multiplayerService.tsとの互換性のため
      },
      paddle1: this.state.paddle1,
      paddle2: this.state.paddle2,
      canvasWidth: this.state.canvasWidth,
      canvasHeight: this.state.canvasHeight,
      paddleHits: this.state.paddleHits || 0,

      // multiplayerService.tsとの互換性のため
      players: {
        player1: {
          x: this.state.paddle1.x,
          y: this.state.paddle1.y,
        },
        player2: {
          x: this.state.paddle2.x,
          y: this.state.paddle2.y,
        },
      },
      score: this.score || { player1: 0, player2: 0 },
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      winner: this.winner,
      timestamp: Date.now(),
    };
  }

  public draw(ctx: CanvasRenderingContext2D, paddleAndBallColor: string = '#212121'): void {
    // ミニゲームの場合は描画をスキップ（計算量削減）
    if (this.state.canvasWidth === 100 && this.state.canvasHeight === 100) {
      return; // 描画処理をスキップして計算量を大幅削減
    }

    const { ball, paddle1, paddle2, canvasWidth } = this.state;

    ctx.clearRect(0, 0, canvasWidth, this.state.canvasHeight);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, 0, canvasWidth, this.state.canvasHeight);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = paddleAndBallColor;
    ctx.fill();

    ctx.fillStyle = paddleAndBallColor;
    ctx.fillRect(paddle1.x, paddle1.y, paddle1.width, paddle1.height);
    ctx.fillRect(paddle2.x, paddle2.y, paddle2.width, paddle2.height);
  }

  // マルチプレイヤー用メソッド
  public setAuthoritativeClient(isAuthoritative: boolean): void {
    this.isAuthoritativeClient = isAuthoritative;
  }

  public setGameStateUpdateCallback(callback: (gameState: GameState) => void): void {
    this.gameStateUpdateCallback = callback;
  }

  // スコア更新コールバックを設定
  public setScoreUpdateCallback(callback: ((scorer: 'player1' | 'player2') => void) | null): void {
    this.scoreUpdateCallback = callback;
  }

  // スコアをリセット
  public resetScore(): void {
    this.score.player1 = 0;
    this.score.player2 = 0;
    this.state.score.player1 = 0;
    this.state.score.player2 = 0;
    this.state.gameOver = false;
    this.state.winner = null;
    this.gameOver = false;
    this.winner = null;
    debugLog('Score reset to 0:0');
  }

  // パドル位置とplayers同期メソッド
  public syncPlayersPosition(): void {
    this.state.players.player1.x = this.state.paddle1.x;
    this.state.players.player1.y = this.state.paddle1.y;
    this.state.players.player2.x = this.state.paddle2.x;
    this.state.players.player2.y = this.state.paddle2.y;
  }

  // リモートゲーム状態の同期（マルチプレイヤー用）
  public syncGameState(remoteState: GameState): void {
    debugLog('Syncing game state:', remoteState);

    // ボール状態の同期
    this.state.ball.x = remoteState.ball.x;
    this.state.ball.y = remoteState.ball.y;
    this.state.ball.dx = remoteState.ball.vx || remoteState.ball.dx;
    this.state.ball.dy = remoteState.ball.vy || remoteState.ball.dy;
    this.state.ball.vx = remoteState.ball.vx || remoteState.ball.dx;
    this.state.ball.vy = remoteState.ball.vy || remoteState.ball.dy;

    // パドル状態の同期
    if (remoteState.players) {
      this.state.paddle1.x = remoteState.players.player1.x;
      this.state.paddle1.y = remoteState.players.player1.y;
      this.state.paddle2.x = remoteState.players.player2.x;
      this.state.paddle2.y = remoteState.players.player2.y;
    }

    // パドルとplayersの同期
    this.syncPlayersPosition();

    // スコア・ゲーム状態の同期
    if (remoteState.score) {
      this.score = { ...remoteState.score };
      this.state.score = { ...remoteState.score };
    }

    this.gameStarted = remoteState.gameStarted;
    this.gameOver = remoteState.gameOver;
    this.winner = remoteState.winner;

    this.state.gameStarted = remoteState.gameStarted;
    this.state.gameOver = remoteState.gameOver;
    this.state.winner = remoteState.winner;
    this.state.timestamp = remoteState.timestamp;
  }

  // syncGameStateのエイリアス（命名の一貫性のため）
  public syncWithRemoteState(remoteState: GameState): void {
    this.syncGameState(remoteState);
  }

  /**
   * ゲームエンジンをクリーンアップする
   */
  public cleanup(): void {
    // NPCエンジンの停止
    if (this.npcEngine) {
      this.npcEngine = null;
    }
    if (this.npcEngine2) {
      this.npcEngine2 = null;
    }

    // 状態をリセット
    this.state.gameStarted = false;
    this.state.gameOver = false;
    this.state.winner = null;
    this.state.score.player1 = 0;
    this.state.score.player2 = 0;

    // ボールをリセット
    this.resetBall();
  }
}
