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

export interface GameState {
  ball: Ball;
  paddle1: Paddle;
  paddle2: Paddle;
  canvasWidth: number;
  canvasHeight: number;
  paddleHits: number;
}

export interface NPCConfig {
  enabled: boolean;
  player: 1 | 2;
  mode: 'heuristic' | 'pid' | 'technician';
  reactionDelay: number;
  positionNoise: number;
  followGain: number;
  returnRate: number;
  reactionDelayMs: number;
  maxSpeed: number;
  trackingNoise: number;
  trackingTimeout: number;
  difficulty: 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom';
  pid?: {
    kp: number;
    ki: number;
    kd: number;
    maxIntegral: number;
    derivativeFilter: number;
    maxControlSpeed: number;
  };
  technician?: {
    predictionAccuracy: number;
    courseAccuracy: number;
  };
}

export interface GameConfig {
  canvasWidth?: number;
  canvasHeight?: number;
  winningScore: number;
  maxBallSpeed: number;
  paddleSpeed: number;
  ballRadiusRatio: number; // キャンバス幅に対する比率
  paddleWidthRatio: number; // キャンバス幅に対する比率
  paddleHeightRatio: number; // キャンバス高さに対する比率
  initialBallSpeed: number;
  npc: NPCConfig;
  npc2?: NPCConfig; // NPC vs NPC用の2つ目のNPC設定
}

export const DIFFICULTY_SETTINGS = {
  Nightmare: {
    returnRate: 0.99, reactionDelayMs: 50, maxSpeed: 288, trackingNoise: 2, trackingTimeout: 10000, // 240 * 1.2
    pid: { kp: 1.50, ki: 0.04, kd: 0.15, maxIntegral: 120, derivativeFilter: 0.6, maxControlSpeed: 900 },
    technician: { predictionAccuracy: 0.95, courseAccuracy: 0.9 }
  },
  Hard: {
    returnRate: 0.92, reactionDelayMs: 80, maxSpeed: 264, trackingNoise: 3, trackingTimeout: 8000, // 240 * 1.1
    pid: { kp: 1.35, ki: 0.05, kd: 0.13, maxIntegral: 110, derivativeFilter: 0.55, maxControlSpeed: 800 },
    technician: { predictionAccuracy: 0.88, courseAccuracy: 0.82 }
  },
  Normal: {
    returnRate: 0.80, reactionDelayMs: 200, maxSpeed: 192, trackingNoise: 10, trackingTimeout: 6000, // 240 * 0.8
    pid: { kp: 1.00, ki: 0.10, kd: 0.08, maxIntegral: 80, derivativeFilter: 0.4, maxControlSpeed: 600 },
    technician: { predictionAccuracy: 0.8, courseAccuracy: 0.7 }
  },
  Easy: {
    returnRate: 0.65, reactionDelayMs: 350, maxSpeed: 132, trackingNoise: 15, trackingTimeout: 4000, // 240 * 0.55
    pid: { kp: 0.70, ki: 0.08, kd: 0.03, maxIntegral: 60, derivativeFilter: 0.25, maxControlSpeed: 450 },
    technician: { predictionAccuracy: 0.65, courseAccuracy: 0.55 }
  },
};

export const DEFAULT_NPC_CONFIG: NPCConfig = {
  enabled: true,
  player: 1,
  mode: 'pid',
  reactionDelay: 0.1,
  positionNoise: 5,
  followGain: 0.8,
  returnRate: 0.8,
  reactionDelayMs: 200,
  maxSpeed: 240, // プレイヤーと統一した240 pixels/second
  trackingNoise: 10,
  trackingTimeout: 6000,
  difficulty: 'Normal',
  pid: {
    kp: 1.0,
    ki: 0.1,
    kd: 0.08,
    maxIntegral: 80,
    derivativeFilter: 0.4,
    maxControlSpeed: 600,
  },
  technician: {
    predictionAccuracy: 0.8,
    courseAccuracy: 0.7,
  },
};

export const DEFAULT_CONFIG: GameConfig = {
  winningScore: 11,
  maxBallSpeed: 4, // ボール最大速度をさらに制限（遅くしました）
  paddleSpeed: 10, // パドル速度を10に変更
  ballRadiusRatio: 0.02, // キャンバス幅の2%（ミニゲーム用）
  paddleWidthRatio: 0.08, // キャンバス幅の8%（ミニゲーム用）
  paddleHeightRatio: 0.015, // キャンバス高さの1.5%（ミニゲーム用）
  initialBallSpeed: 0.6, // 初期ボール速度をさらに低く（遅くしました）
  npc: DEFAULT_NPC_CONFIG,
};

export interface NPCGameSession {
  id: string;
  gameState: GameState;
  config: GameConfig;
  score: { player1: number; player2: number };
  isRunning: boolean;
  lastUpdate: number;
  sessionType: 'npc_vs_npc';
}

export interface NPCGameResponse {
  gameId: string;
  gameState: GameState;
  score: { player1: number; player2: number };
  isRunning: boolean;
  winner?: 'player1' | 'player2';
}
