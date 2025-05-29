import { NPCConfig, GameState, NPCDebugInfo } from './npcTypes';

// NPCアルゴリズムの基底インターフェース
export interface NPCAlgorithm {
  updateConfig(config: Partial<NPCConfig>): void;
  calculateMovement(gameState: GameState, npcPaddle: { x: number; y: number; width: number; height: number }, paddleSpeed?: number): {
    targetX?: number;
    movement?: number;
    pidOutput?: number;
    techniqueEffect?: {
      type: string;
      forceVerticalReturn?: boolean;
      player?: number;
      maxAngleDegrees?: number;
    };
  };
  getDebugInfo?(): any;
  getCurrentState?(): any;
  getStateStartTime?(): number;
  getTargetPosition?(): number;
}

// NPCファクトリー
export class NPCFactory {
  private static algorithms = new Map<string, new (config: NPCConfig, canvasWidth?: number) => NPCAlgorithm>();

  static registerAlgorithm(name: string, algorithmClass: new (config: NPCConfig, canvasWidth?: number) => NPCAlgorithm): void {
    this.algorithms.set(name, algorithmClass);
  }

  static createAlgorithm(name: string, config: NPCConfig, canvasWidth?: number): NPCAlgorithm {
    const AlgorithmClass = this.algorithms.get(name);
    if (!AlgorithmClass) {
      throw new Error(`Unknown NPC algorithm: ${name}`);
    }
    return new AlgorithmClass(config, canvasWidth);
  }

  static getAvailableAlgorithms(): string[] {
    return Array.from(this.algorithms.keys());
  }
}

export class NPCEngine {
  private config: NPCConfig;
  private currentAlgorithm: NPCAlgorithm;

  // NPC処理頻度制限用
  private lastNPCUpdateTime: number = 0;
  private npcUpdateInterval: number = 10;
  private lastNPCDecision: {
    targetX: number;
    movement: number;
    pidOutput: number;
    techniqueEffect?: {
      type: string;
      forceVerticalReturn?: boolean;
      player?: number;
      maxAngleDegrees?: number;
    };
  } = { targetX: 0, movement: 0, pidOutput: 0 };

  constructor(config: NPCConfig, canvasWidth: number) {
    this.config = { ...config };
    this.currentAlgorithm = NPCFactory.createAlgorithm(config.mode, this.config, canvasWidth);
  }

  public updateConfig(config: Partial<NPCConfig>): void {
    this.config = { ...this.config, ...config };

    // アルゴリズムが変更された場合は新しいインスタンスを作成
    if (config.mode && config.mode !== this.config.mode) {
      this.currentAlgorithm = NPCFactory.createAlgorithm(config.mode, this.config);
    } else {
      // 既存のアルゴリズムの設定を更新
      this.currentAlgorithm.updateConfig(config);
    }
  }

  public updatePaddle(gameState: GameState, paddleSpeed: number): void {
    if (!this.config.enabled) return;

    const currentTime = Date.now();
    const npcPaddle = this.config.player === 1 ? gameState.paddle1 : gameState.paddle2;

    // NPC判断を制限された間隔で実行
    if (currentTime - this.lastNPCUpdateTime >= this.npcUpdateInterval) {
      this.lastNPCUpdateTime = currentTime;

      // 現在のアルゴリズムで判断を実行
      const result = this.currentAlgorithm.calculateMovement(gameState, npcPaddle, paddleSpeed);

      this.lastNPCDecision.targetX = result.targetX || 0;
      this.lastNPCDecision.movement = result.movement || 0;
      this.lastNPCDecision.pidOutput = result.pidOutput || 0;
      this.lastNPCDecision.techniqueEffect = result.techniqueEffect;
    }

    // 保存された判断結果を適用
    this.applyNPCDecision(npcPaddle, gameState.canvasWidth);
  }

  // 現在のアクティブな技効果を取得
  public getActiveTechniqueEffect(): any {
    return this.lastNPCDecision.techniqueEffect || undefined;
  }

  // 技効果をリセット
  public resetTechniqueEffect(): void {
    this.lastNPCDecision.techniqueEffect = undefined;
    // TechnicianNPCの場合、内部状態もリセット
    if (this.currentAlgorithm && typeof (this.currentAlgorithm as any).resetTechniqueEffect === 'function') {
      (this.currentAlgorithm as any).resetTechniqueEffect();
    }
  }

  private applyNPCDecision(npcPaddle: { x: number; width: number }, canvasWidth: number): void {
    let newX: number;

    if (this.config.mode === 'pid') {
      // PIDモードの場合
      newX = npcPaddle.x + this.lastNPCDecision.pidOutput;
      const margin = 1;
      newX = Math.max(margin, Math.min(newX, canvasWidth - npcPaddle.width - margin));

      if (Math.abs(newX - npcPaddle.x) > 0.15) {
        npcPaddle.x = newX;
      }
    } else {
      // その他のモードの場合
      newX = Math.max(0, Math.min(
        npcPaddle.x + this.lastNPCDecision.movement,
        canvasWidth - npcPaddle.width
      ));

      npcPaddle.x = newX;
    }
  }

  public getDebugInfo(): NPCDebugInfo {
    // 現在のアルゴリズムからデバッグ情報を取得
    const algorithmDebugInfo = this.currentAlgorithm.getDebugInfo?.() || {};

    const baseInfo = {
      state: this.config.mode === 'pid' ? 'PID' : (this.currentAlgorithm.getCurrentState?.() || 'UNKNOWN'),
      timeInState: Date.now() - (this.currentAlgorithm.getStateStartTime?.() || Date.now()),
      returnRate: this.config.returnRate,
      targetPosition: this.currentAlgorithm.getTargetPosition?.() || 0,
    };

    return { ...baseInfo, ...algorithmDebugInfo };
  }
}

// 既存のアルゴリズムを登録（この部分は各アルゴリズムファイルで行う）
// NPCFactory.registerAlgorithm('heuristic', HeuristicNPC);
// NPCFactory.registerAlgorithm('pid', PIDNPC);
