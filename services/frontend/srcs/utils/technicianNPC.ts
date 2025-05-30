import { NPCConfig, GameState } from './npcTypes';
import { NPCAlgorithm, NPCFactory } from './npcEngine';

interface DifficultySettings {
  reactionDelay: number; // 反応遅延（ミリ秒）
  predictionAccuracy: number; // 予測精度（0-1）
  courseAccuracy: number; // コース精度（0-1）
}

enum TechniqueType {
  COURSE = 'course',
  STRAIGHT = 'straight',
  BOUNCE = 'bounce',
  DOUBLE_BOUNCE = 'double_bounce'
}

interface Action {
  technique: TechniqueType;
  targetPosition: number;
  utility: number;
}

export class TechnicianNPC implements NPCAlgorithm {
  private gameState: GameState;
  private difficulty: DifficultySettings;
  private lastUpdateTime: number = 0;
  private isReturning: boolean = false;
  private targetPosition: number = 0;
  private currentAction: Action | null = null;
  private config: NPCConfig;

  // パドル移動権利システム
  private hasMovementPermission: boolean = false;
  private permissionGrantedTime: number = 0;
  private lastGameState: { paddleHits: number } = { paddleHits: 0 };

  // 技の多様性のための変数
  private lastTechnique: TechniqueType | null = null;
  private techniqueHistory: TechniqueType[] = [];

  // 返球時の技効果フラグ
  private activeTechniqueEffect: {
    type: TechniqueType | null;
    shouldApply: boolean;
  } = {
    type: null,
    shouldApply: false
  };

  // 内部状態用の追加プロパティ
  private internalState = {
    npcPaddlePosition: 0,
    playerPaddlePosition: 0,
    fieldWidth: 800,
    fieldHeight: 400,
    paddleHeight: 12
  };

  // スムーズな移動のための補間用変数
  private smoothMovement = {
    currentX: 0,
    targetX: 0,
    speed: 8
  };

  // ビュー更新制限のための変数
  private lastViewUpdateTime: number = 0;
  private viewUpdateInterval: number = 1000; // 1秒間隔
  private cachedBallArrivalX: number = 0;

  // キャッシュされたゲーム状態（1秒に1回のみ更新）
  private cachedGameView: {
    ballPosition: { x: number; y: number };
    playerPaddlePosition: number;
    npcPaddlePosition: number;
    ballMovingToNPC: boolean;
    lastUpdateTime: number;
  } = {
    ballPosition: { x: 0, y: 0 },
    playerPaddlePosition: 0,
    npcPaddlePosition: 0,
    ballMovingToNPC: false,
    lastUpdateTime: 0
  };

  constructor(config: NPCConfig) {
    this.config = config;
    this.difficulty = {
      reactionDelay: config.reactionDelayMs || 150,
      predictionAccuracy: 1.0, // デバッグ用：予測精度を最大に設定
      courseAccuracy: 1.0 // デバッグ用：コース精度も最大に設定
    };
    this.gameState = {
      ball: { x: 0, y: 0, dx: 0, dy: 0, radius: 8, speed: 4, speedMultiplier: 1 },
      paddle1: { x: 0, y: 0, width: 80, height: 12 },
      paddle2: { x: 0, y: 0, width: 80, height: 12 },
      canvasWidth: 800,
      canvasHeight: 400,
      paddleHits: 0
    };

    // 試合開始後すぐに権利を付与
    this.hasMovementPermission = true;
    this.permissionGrantedTime = Date.now();
    // 初回の時間更新を設定（すぐに次の権利を得られるように）
    this.lastViewUpdateTime = Date.now() - this.viewUpdateInterval;
  }

  public updateConfig(config: Partial<NPCConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.technician) {
      this.difficulty = {
        reactionDelay: config.reactionDelayMs || this.difficulty.reactionDelay,
        predictionAccuracy: 1.0, // デバッグ用：常に最大精度
        courseAccuracy: 1.0 // デバッグ用：常に最大精度
      };
    }
  }

  public calculateMovement(gameState: GameState, npcPaddle: { x: number; y: number; width: number; height: number }): { targetX: number; movement: number; techniqueEffect?: any } {
    // 現在のパドル位置のみ毎フレーム更新（物理的な位置情報）
    this.smoothMovement.currentX = npcPaddle.x + npcPaddle.width / 2;

    // 1秒に1回のみゲームビューを更新
    const currentTime = Date.now();
    if (currentTime - this.lastViewUpdateTime >= this.viewUpdateInterval) {
      this.updateGameView(gameState, npcPaddle);
      this.lastViewUpdateTime = currentTime;

      // パドル移動権利を付与
      this.hasMovementPermission = true;
      this.permissionGrantedTime = currentTime;

      this.update(); // 技の選択も1秒に1回
    }

    // 得点後の検出（paddleHitsがリセットされた場合）
    // これは物理的なゲーム状態の変化なので毎フレームチェック可能
    if (gameState.paddleHits < this.lastGameState.paddleHits) {
      // 得点が発生したので初回権利を付与
      this.grantInitialPermission();
    }
    this.lastGameState.paddleHits = gameState.paddleHits;

    // キャッシュされたビュー情報を使用して判定
    const shouldMove = this.hasMovementPermission &&
      (this.cachedGameView.ballMovingToNPC || this.isInitialMovement());

    if (shouldMove) {
      // キャッシュされた予測を使用
      const targetBallX = this.cachedBallArrivalX || this.cachedGameView.ballPosition.x;
      this.smoothMovement.targetX = targetBallX - npcPaddle.width / 2;

      // スムーズな移動を計算
      const deltaX = this.smoothMovement.targetX - this.smoothMovement.currentX;
      const movement = Math.sign(deltaX) * Math.min(Math.abs(deltaX), this.smoothMovement.speed);

      // 技効果の情報を含めて返す
      const result: any = {
        targetX: this.smoothMovement.targetX,
        movement: movement
      };

      // アクティブな技効果がある場合は追加
      if (this.activeTechniqueEffect.shouldApply) {
        result.techniqueEffect = {
          type: this.activeTechniqueEffect.type,
          forceVerticalReturn: this.activeTechniqueEffect.type === TechniqueType.STRAIGHT,
          player: this.config.player
        };
      }

      return result;
    } else {
      // 権利がないか、ボールが向かってこない場合は動かない
      return {
        targetX: this.smoothMovement.currentX,
        movement: 0
      };
    }
  }

  // 1秒に1回のみ実行されるゲームビュー更新
  private updateGameView(gameState: GameState, npcPaddle: { x: number; y: number; width: number; height: number }): void {
    // ゲーム状態を更新（1秒に1回のみ）
    this.gameState = gameState;

    // キャッシュされたビューを更新
    this.cachedGameView = {
      ballPosition: { x: gameState.ball.x, y: gameState.ball.y },
      playerPaddlePosition: this.config.player === 1 ?
        gameState.paddle2.x + gameState.paddle2.width / 2 :
        gameState.paddle1.x + gameState.paddle1.width / 2,
      npcPaddlePosition: npcPaddle.x + npcPaddle.width / 2,
      ballMovingToNPC: this.config.player === 1 ?
        gameState.ball.dy < 0 : gameState.ball.dy > 0,
      lastUpdateTime: Date.now()
    };

    // 内部状態を更新（1秒に1回のみ）
    this.internalState.npcPaddlePosition = this.cachedGameView.npcPaddlePosition;
    this.internalState.playerPaddlePosition = this.cachedGameView.playerPaddlePosition;
    this.internalState.fieldWidth = gameState.canvasWidth;
    this.internalState.fieldHeight = gameState.canvasHeight;
    this.internalState.paddleHeight = npcPaddle.height;

    // ボール到着予測を更新（1秒に1回のみ）
    this.cachedBallArrivalX = this.predictBallArrivalX();
  }

  // 得点後の初回権利付与
  private grantInitialPermission(): void {
    this.hasMovementPermission = true;
    this.permissionGrantedTime = Date.now();

    // 現在のアクションをリセット（新しいラウンドの準備）
    this.currentAction = null;
    this.isReturning = false;

    // 予測をリセット（現在のキャッシュされた情報を使用）
    this.cachedBallArrivalX = this.cachedGameView.ballPosition.x;

    // 技の履歴もリセット（新しいラウンドなので）
    this.lastTechnique = null;
  }

  // 初回移動判定（試合開始直後の位置取りのため）
  private isInitialMovement(): boolean {
    // permissionGrantedTimeから2秒以内かつ、まだアクションが計画されていない場合
    const timeSincePermission = Date.now() - this.permissionGrantedTime;
    return timeSincePermission < 2000 && !this.currentAction && !this.isReturning;
  }

  // 返球率を調整してゲームバランスを改善
  public getReturnSuccessRate(): number {
    const accuracyFactor = this.difficulty.predictionAccuracy * this.difficulty.courseAccuracy;
    // 最大返球率を98%に調整（95% → 98%に向上）
    return Math.min(0.98, accuracyFactor * 0.95); // 0.90 → 0.95に向上
  }

  private predictBallArrivalX(): number {
    // キャッシュされたゲームビューを使用（1秒に1回のみ更新）
    const ball = {
      x: this.cachedGameView.ballPosition.x,
      y: this.cachedGameView.ballPosition.y,
      dx: this.gameState.ball.dx, // 速度情報は物理演算から取得
      dy: this.gameState.ball.dy
    };

    const npcY = this.config.player === 1 ? this.gameState.paddle1.y : this.gameState.paddle2.y;

    // キャッシュされたボール方向情報を使用
    if (!this.cachedGameView.ballMovingToNPC || Math.abs(ball.dy) < 0.1) {
      return ball.x; // ボールが向かってこない場合は現在位置
    }

    // NPCのパドル位置までの時間を計算
    const timeToReach = Math.abs((npcY - ball.y) / ball.dy);

    // X座標の予測（壁での反射を考慮）
    let futureX = ball.x + ball.dx * timeToReach;

    // 壁での反射を計算
    while (futureX < 0 || futureX > this.gameState.canvasWidth) {
      if (futureX < 0) {
        futureX = -futureX;
      } else if (futureX > this.gameState.canvasWidth) {
        futureX = 2 * this.gameState.canvasWidth - futureX;
      }
    }

    // デバッグ用：予測精度を最大にするため、エラーを完全に排除
    const predictedX = futureX;

    return Math.max(0, Math.min(this.gameState.canvasWidth, predictedX));
  }

  public update(): { paddlePosition: number; shouldReturn: boolean } {
    // キャッシュされたゲームビューを使用
    const ballMovingToNPC = this.cachedGameView.ballMovingToNPC;

    // 権利を持っていて、ボールがNPC側に向かっている場合のみアクションを計画
    // または、初回移動の場合
    const shouldPlanAction = this.hasMovementPermission &&
      (ballMovingToNPC || this.isInitialMovement()) &&
      !this.isReturning;

    if (shouldPlanAction) {
      // 反応遅延後にアクションを計画
      setTimeout(() => {
        this.planAction();
      }, this.difficulty.reactionDelay);

      // 権利を使用したのでリセット
      this.hasMovementPermission = false;
    }

    return this.executeCurrentAction();
  }

  private applyDiversityPenalty(actions: Action[]): Action[] {
    return actions.map(action => {
      let penaltyMultiplier = 1.0;

      // 前回と同じ技の場合、完全に排除
      if (this.lastTechnique === action.technique) {
        penaltyMultiplier = 0.0; // 完全に無効化
      }

      // 履歴に含まれる技の場合、軽いペナルティを適用
      const recentUsage = this.techniqueHistory.filter(t => t === action.technique).length;
      if (recentUsage > 0 && penaltyMultiplier > 0) {
        penaltyMultiplier *= Math.max(0.5, 1.0 - (recentUsage * 0.2));
      }

      return {
        ...action,
        utility: action.utility * penaltyMultiplier
      };
    });
  }

  private planAction(): void {
    const ballArrivalX = this.predictBallArrivalX();
    const actions = this.generatePossibleActions(ballArrivalX);

    // 連続使用ペナルティを適用
    const filteredActions = this.applyDiversityPenalty(actions);

    // 有効なアクション（utility > 0）のみを考慮
    const validActions = filteredActions.filter((action: Action) => action.utility > 0);

    // 有効なアクションがない場合は、前回以外の技から選択
    let bestAction: Action;
    if (validActions.length === 0) {
      const nonRepeatingActions = actions.filter((action: Action) => action.technique !== this.lastTechnique);
      bestAction = nonRepeatingActions.reduce((best: Action, current: Action) =>
        current.utility > best.utility ? current : best
      );
    } else {
      bestAction = validActions.reduce((best: Action, current: Action) =>
        current.utility > best.utility ? current : best
      );
    }

    this.currentAction = bestAction;
    this.isReturning = true;
    this.targetPosition = ballArrivalX;

    // 技の履歴更新をplanActionから削除（executeCurrentActionで行う）
    // this.updateTechniqueHistory(bestAction.technique); // この行を削除
  }

  private updateTechniqueHistory(technique: TechniqueType): void {
    // 前回の技を記録
    this.lastTechnique = technique;

    // 履歴に追加（最大5個まで保持）
    this.techniqueHistory.push(technique);
    if (this.techniqueHistory.length > 5) {
      this.techniqueHistory.shift(); // 古いものを削除
    }
  }

  private generatePossibleActions(ballArrivalX: number): Action[] {
    const actions: Action[] = [];
    const isAtCenter = Math.abs(this.internalState.npcPaddlePosition - this.internalState.fieldWidth / 2) < 50;
    const isAtEdge = !isAtCenter;

    actions.push({
      technique: TechniqueType.COURSE,
      targetPosition: ballArrivalX,
      utility: this.calculateCourseUtility(isAtCenter)
    });

    actions.push({
      technique: TechniqueType.STRAIGHT,
      targetPosition: ballArrivalX,
      utility: this.calculateStraightUtility(isAtEdge)
    });

    actions.push({
      technique: TechniqueType.BOUNCE,
      targetPosition: ballArrivalX,
      utility: this.calculateBounceUtility()
    });

    actions.push({
      technique: TechniqueType.DOUBLE_BOUNCE,
      targetPosition: ballArrivalX,
      utility: this.calculateDoubleBounceUtility(isAtEdge)
    });

    return actions;
  }

  private calculateCourseUtility(isAtCenter: boolean): number {
    // デバッグ用：ストレート以外は無効化
    return 0;

    // プレイヤー距離ボーナスを削除し、シンプルな基本値ベースに
    let utility = 0.6; // 基本値のみ

    // 中央にいる場合はコースショットを大幅に優遇
    if (isAtCenter) {
      utility += 0.35;
    }

    // ランダム要素を追加
    utility += (Math.random() - 0.5) * 0.1;

    return Math.max(0.1, Math.min(1.0, utility));
  }

  private calculateStraightUtility(isAtEdge: boolean): number {
    let utility = 0.9; // ストレート技を最優先にするため高い値に設定

    // 端にいる場合の距離ボーナスを計算
    if (isAtEdge) {
      const npcPosition = this.internalState.npcPaddlePosition;
      const playerPosition = this.internalState.playerPaddlePosition;
      const fieldWidth = this.internalState.fieldWidth;

      // NPCと相手プレイヤーの距離を計算
      const distance = Math.abs(npcPosition - playerPosition);
      const maxDistance = fieldWidth; // 最大距離
      const distanceRatio = distance / maxDistance;

      // 基本的な端ボーナス
      utility += 0.2;

      // 距離に応じたボーナス（離れているほど高評価）
      utility += distanceRatio * 0.3; // 最大0.3のボーナス
    }

    // ランダム要素を追加
    utility += (Math.random() - 0.5) * 0.2;

    return Math.max(0.1, Math.min(1.0, utility));
  }

  private calculateBounceUtility(): number {
    // デバッグ用：ストレート以外は無効化
    return 0;

    // BOUNCEのユーティリティを下げて他の技も選ばれやすくする
    let utility = 0.4;

    // ランダム要素を追加
    utility += (Math.random() - 0.5) * 0.3;

    return Math.max(0.1, Math.min(1.0, utility));
  }

  private calculateDoubleBounceUtility(isAtEdge: boolean): number {
    // デバッグ用：ストレート以外は無効化
    return 0;

    let utility = 0.35; // 0.45 → 0.35に下げてBOUNCE(0.4)より低く設定

    // 端にいる場合はダブルバウンドを優遇
    if (isAtEdge) {
      utility += 0.25;
    }

    // ランダム要素を追加
    utility += (Math.random() - 0.5) * 0.2;

    return Math.max(0.1, Math.min(1.0, utility));
  }

  /**
   * STRAIGHT技のための精密な位置計算
   * 完全にまっすぐ返球するため、パドルの正確な中央でボールを捉える
   */
  private calculateStraightTarget(): number {
    const ballX = this.gameState.ball.x;
    const ballY = this.gameState.ball.y;
    const ballDx = this.gameState.ball.dx;
    const ballDy = this.gameState.ball.dy;

    // NPCのパドル位置を取得
    const npcPaddle = this.config.player === 1 ? this.gameState.paddle1 : this.gameState.paddle2;
    const paddleY = npcPaddle.y;
    const paddleWidth = npcPaddle.width;

    // ボールがパドルに到達する時のX座標を予測
    let predictedBallX = ballX;

    if (Math.abs(ballDy) > 0.1) {
      const timeToReach = Math.abs((paddleY - ballY) / ballDy);
      predictedBallX = ballX + ballDx * timeToReach;

      // 壁での反射を考慮
      while (predictedBallX < 0 || predictedBallX > this.gameState.canvasWidth) {
        if (predictedBallX < 0) {
          predictedBallX = -predictedBallX;
        } else if (predictedBallX > this.gameState.canvasWidth) {
          predictedBallX = 2 * this.gameState.canvasWidth - predictedBallX;
        }
      }
    }

    // 完全にまっすぐ返球するため、パドルの正確な中央に位置取り
    // パドルの中央がボールの予測位置に正確に合うように調整
    const targetX = predictedBallX - paddleWidth / 2;

    // フィールド境界内に制限
    const clampedTargetX = Math.max(0, Math.min(this.internalState.fieldWidth - paddleWidth, targetX));

    return clampedTargetX + paddleWidth / 2; // パドル中央座標として返す
  }

  private calculateBounceTarget(): number {
    const ballX = this.gameState.ball.x;
    const fieldWidth = this.internalState.fieldWidth;

    // 左右どちらかの壁で反射させる
    if (ballX < fieldWidth / 2) {
      // ボールが左半分にある場合、右壁で反射
      return fieldWidth * 0.85; // 右壁近く
    } else {
      // ボールが右半分にある場合、左壁で反射
      return fieldWidth * 0.15; // 左壁近く
    }
  }

  private calculateDoubleBounceTarget(): number {
    const ballX = this.gameState.ball.x;
    const fieldWidth = this.internalState.fieldWidth;

    // 2回反射を考慮した複雑な軌道
    if (ballX < fieldWidth / 3) {
      return fieldWidth * 0.9; // 右端で2回反射
    } else if (ballX > fieldWidth * 2 / 3) {
      return fieldWidth * 0.1; // 左端で2回反射
    } else {
      // 中央の場合はランダムに選択
      return Math.random() > 0.5 ? fieldWidth * 0.9 : fieldWidth * 0.1;
    }
  }

  private moveTowards(targetX: number): number {
    const currentX = this.internalState.npcPaddlePosition;
    const speed = 7; // 6 → 7に向上（移動速度向上）
    const direction = targetX > currentX ? 1 : -1;
    const distance = Math.abs(targetX - currentX);

    // 移動閾値（微細な移動を抑制するため）
    const moveThreshold = 15; // 20 → 15に減少（より精密な位置取り）
    if (distance < moveThreshold) {
      return currentX; // 現在位置を維持
    }

    if (distance < speed) {
      return targetX;
    }

    const newPosition = currentX + direction * speed;
    return Math.max(0, Math.min(this.internalState.fieldWidth, newPosition));
  }

  private moveToCenter(): number {
    const center = this.internalState.fieldWidth / 2;
    return this.moveTowards(center);
  }

  // 技効果をリセットするメソッド（ボールとの接触後に呼ばれる）
  public resetTechniqueEffect(): void {
    this.activeTechniqueEffect = {
      type: null,
      shouldApply: false
    };
  }

  // 現在のアクティブな技効果を取得（角度制限情報を追加）
  public getActiveTechniqueEffect(): {
    type: TechniqueType | null;
    forceVerticalReturn: boolean;
    maxAngleDegrees?: number;
  } {
    const effect = {
      type: this.activeTechniqueEffect.type,
      forceVerticalReturn: this.activeTechniqueEffect.type === TechniqueType.STRAIGHT && this.activeTechniqueEffect.shouldApply
    };

    // STRAIGHT技の場合は最大角度制限を追加
    if (effect.forceVerticalReturn) {
      return {
        ...effect,
        maxAngleDegrees: 15 // 15度以内に制限
      };
    }

    return effect;
  }

  public getDebugInfo(): any {
    return {
      algorithm: 'technician',
      currentAction: this.currentAction?.technique || 'none',
      lastTechnique: this.lastTechnique,
      techniqueHistory: this.techniqueHistory,
      targetPosition: this.targetPosition,
      isReturning: this.isReturning,
      returnSuccessRate: this.getReturnSuccessRate(),
      ballPosition: this.cachedGameView.ballPosition, // キャッシュされた位置を使用
      npcPosition: this.cachedGameView.npcPaddlePosition, // キャッシュされた位置を使用
      activeTechniqueEffect: this.activeTechniqueEffect,
      hasMovementPermission: this.hasMovementPermission,
      permissionAge: this.permissionGrantedTime ? Date.now() - this.permissionGrantedTime : 0,
      isInitialMovement: this.isInitialMovement(),
      lastPaddleHits: this.lastGameState.paddleHits,
      viewUpdateAge: Date.now() - this.cachedGameView.lastUpdateTime, // ビュー更新からの経過時間
      techniqueDiversity: {
        consecutive: this.lastTechnique ? 1 : 0,
        historyLength: this.techniqueHistory.length,
        uniqueTechniques: [...new Set(this.techniqueHistory)].length
      }
    };
  }

  public getCurrentState(): string {
    return this.currentAction?.technique || 'IDLE';
  }

  public getStateStartTime(): number {
    return this.lastUpdateTime;
  }

  public getTargetPosition(): number {
    return this.targetPosition;
  }

  private executeCurrentAction(): { paddlePosition: number; shouldReturn: boolean } {
    if (!this.currentAction) {
      this.activeTechniqueEffect.shouldApply = false;
      return {
        paddlePosition: this.moveToCenter(),
        shouldReturn: false
      };
    }

    let targetX = this.targetPosition;

    switch (this.currentAction.technique) {
      case TechniqueType.STRAIGHT:
        targetX = this.calculateStraightTarget();
        this.activeTechniqueEffect = {
          type: TechniqueType.STRAIGHT,
          shouldApply: true
        };
        break;

      case TechniqueType.COURSE:
        const playerPos = this.internalState.playerPaddlePosition;
        const fieldCenter = this.internalState.fieldWidth / 2;
        if (playerPos < fieldCenter) {
          targetX = this.internalState.fieldWidth * 0.8;
        } else {
          targetX = this.internalState.fieldWidth * 0.2;
        }
        this.activeTechniqueEffect.shouldApply = false;
        break;

      case TechniqueType.BOUNCE:
        targetX = this.calculateBounceTarget();
        this.activeTechniqueEffect.shouldApply = false;
        break;

      case TechniqueType.DOUBLE_BOUNCE:
        targetX = this.calculateDoubleBounceTarget();
        this.activeTechniqueEffect.shouldApply = false;
        break;
    }

    if (this.currentAction.technique !== TechniqueType.STRAIGHT) {
      const courseError = (1 - this.difficulty.courseAccuracy) * 40;
      const randomError = (Math.random() - 0.5) * courseError;
      targetX += randomError;
    }

    const newPosition = this.moveTowards(targetX);
    const shouldReturn = Math.abs(newPosition - targetX) < 25;

    if (shouldReturn) {
      // 返球完了時：技履歴を更新してから現在のアクションをリセット
      this.updateTechniqueHistory(this.currentAction.technique);
      this.currentAction = null;
      this.isReturning = false;
    }

    return {
      paddlePosition: newPosition,
      shouldReturn: shouldReturn
    };
  }
}

// ファクトリーにアルゴリズムを登録
NPCFactory.registerAlgorithm('technician', TechnicianNPC);
