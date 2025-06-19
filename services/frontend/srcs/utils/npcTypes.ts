export interface NPCConfig {
  enabled: boolean;
  player: 1 | 2;
  mode: 'pid' | 'technician';
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

export enum NPCState {
  IDLE = 'IDLE',
  TRACK = 'TRACK',
  MISS = 'MISS',
  SMASH = 'SMASH',
  EDGE_PLAY = 'EDGE_PLAY'
}

export interface GameState {
  ball: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    vx: number; // multiplayerService.tsとの互換性のため
    vy: number; // multiplayerService.tsとの互換性のため
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

  // multiplayerService.tsとの互換性のため
  players: {
    player1: {
      x: number;
      y: number;
    };
    player2: {
      x: number;
      y: number;
    };
  };
  score: {
    player1: number;
    player2: number;
  };
  gameStarted: boolean;
  gameOver: boolean;
  winner: number | null;
  timestamp: number;
}

export interface NPCDebugInfo {
  state: string;
  timeInState: number;
  returnRate: number;
  targetPosition: number;
  pid?: {
    error: number;
    p: number;
    i: number;
    d: number;
    output: number;
  };
}

export const DIFFICULTY_SETTINGS = {
  Nightmare: {
    returnRate: 0.99, reactionDelayMs: 50, maxSpeed: 1.2, trackingNoise: 2, trackingTimeout: 10000,
    pid: { kp: 1.50, ki: 0.04, kd: 0.15, maxIntegral: 120, derivativeFilter: 0.6, maxControlSpeed: 900 },
    technician: { predictionAccuracy: 0.95, courseAccuracy: 0.9 }
  },
  Hard: {
    returnRate: 0.92, reactionDelayMs: 80, maxSpeed: 1.1, trackingNoise: 3, trackingTimeout: 8000, // より強化
    pid: { kp: 1.35, ki: 0.05, kd: 0.13, maxIntegral: 110, derivativeFilter: 0.55, maxControlSpeed: 800 },
    technician: { predictionAccuracy: 0.88, courseAccuracy: 0.82 }
  },
  Normal: {
    returnRate: 0.80, reactionDelayMs: 200, maxSpeed: 0.8, trackingNoise: 10, trackingTimeout: 6000,
    pid: { kp: 1.00, ki: 0.10, kd: 0.08, maxIntegral: 80, derivativeFilter: 0.4, maxControlSpeed: 600 },
    technician: { predictionAccuracy: 0.8, courseAccuracy: 0.7 }
  },
  Easy: {
    returnRate: 0.65, reactionDelayMs: 350, maxSpeed: 0.55, trackingNoise: 15, trackingTimeout: 4000, // より弱く
    pid: { kp: 0.70, ki: 0.08, kd: 0.03, maxIntegral: 60, derivativeFilter: 0.25, maxControlSpeed: 450 },
    technician: { predictionAccuracy: 0.65, courseAccuracy: 0.55 }
  },
};

export const DEFAULT_NPC_CONFIG: NPCConfig = {
  enabled: false,
  player: 2,
  mode: 'technician',
  reactionDelay: 0.1,
  positionNoise: 5,
  followGain: 0.7,
  returnRate: 0.80,
  reactionDelayMs: 200,
  maxSpeed: 0.8,
  trackingNoise: 10,
  trackingTimeout: 6000,
  difficulty: 'Normal',
  pid: {
    kp: 1.00,
    ki: 0.10,
    kd: 0.08,
    maxIntegral: 80,
    derivativeFilter: 0.4,
    maxControlSpeed: 600,
  },
  technician: {
    predictionAccuracy: 0.8,
    courseAccuracy: 0.7
  }
};
