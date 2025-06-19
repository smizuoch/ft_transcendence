// NPC Manager Service Interface
export interface NPCGameState {
  ball: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    radius: number;
    speed: number;
    speedMultiplier: number;
  };
  paddle1: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  paddle2: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  canvasWidth: number;
  canvasHeight: number;
  paddleHits: number;
}

export interface NPCGameResponse {
  gameId: string;
  gameState: NPCGameState;
  score: { player1: number; player2: number };
  isRunning: boolean;
  winner?: 'player1' | 'player2';
}

export interface NPCGameConfig {
  canvasWidth?: number;
  canvasHeight?: number;
  winningScore?: number;
  maxBallSpeed?: number;
  paddleSpeed?: number;
  ballRadiusRatio?: number; // キャンバス幅に対する比率
  paddleWidthRatio?: number; // キャンバス幅に対する比率
  paddleHeightRatio?: number; // キャンバス高さに対する比率
  initialBallSpeed?: number;
  npc?: {
    enabled?: boolean;
    player?: 1 | 2;
    mode?: 'pid' | 'technician';
    difficulty?: 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom';
    reactionDelayMs?: number;
    maxSpeed?: number;
    returnRate?: number;
  };
  npc2?: {
    enabled?: boolean;
    player?: 1 | 2;
    mode?: 'pid' | 'technician';
    difficulty?: 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom';
    reactionDelayMs?: number;
    maxSpeed?: number;
    returnRate?: number;
  };
}

class NPCManagerService {
  private baseUrl: string;

  constructor() {
    // ブラウザからnginxプロキシ経由でnpc_managerサービスにアクセス
    this.baseUrl = '/api/npc_manager';
  }

  /**
   * 新しいNPC vs NPCゲームを作成
   */
  async createGame(config?: NPCGameConfig): Promise<{ success: boolean; data?: NPCGameResponse; gameId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config || {}),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to create NPC game:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * 特定のゲームの状態を取得
   */
  async getGameState(gameId: string): Promise<{ success: boolean; data?: NPCGameResponse; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/games/${gameId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get game state:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * 全てのアクティブなゲームの状態を取得
   */
  async getAllActiveGames(): Promise<{ success: boolean; data?: NPCGameResponse[]; count?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/games`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get active games:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * ランダムなゲームにスピードブーストを適用
   */
  async applySpeedBoost(excludeGameId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/speed-boost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ excludeGameId }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to apply speed boost:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * 特定のゲームにスピードブーストを適用
   */
  async applySpeedBoostToGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/games/${gameId}/speed-boost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to apply speed boost to game:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * ゲームを停止
   */
  async stopGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/games/${gameId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to stop game:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * NPC Manager統計情報を取得
   */
  async getStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/npc/stats`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; activeGames: number; totalGames: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        activeGames: 0,
        totalGames: 0
      };
    }
  }
}

// シングルトンインスタンス
export const npcManagerService = new NPCManagerService();

// React Hooks for NPC Manager
export const useNPCManager = () => {
  return {
    createGame: npcManagerService.createGame.bind(npcManagerService),
    getGameState: npcManagerService.getGameState.bind(npcManagerService),
    getAllActiveGames: npcManagerService.getAllActiveGames.bind(npcManagerService),
    applySpeedBoost: npcManagerService.applySpeedBoost.bind(npcManagerService),
    applySpeedBoostToGame: npcManagerService.applySpeedBoostToGame.bind(npcManagerService),
    stopGame: npcManagerService.stopGame.bind(npcManagerService),
    getStats: npcManagerService.getStats.bind(npcManagerService),
    healthCheck: npcManagerService.healthCheck.bind(npcManagerService),
  };
};
