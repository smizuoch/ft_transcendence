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
    returnRate: 0.95, reactionDelayMs: 100, maxSpeed: 1.0, trackingNoise: 5, trackingTimeout: 8000,
    pid: { kp: 1.25, ki: 0.06, kd: 0.12, maxIntegral: 100, derivativeFilter: 0.5, maxControlSpeed: 750 },
    technician: { predictionAccuracy: 0.85, courseAccuracy: 0.8 }
  },
  Normal: {
    returnRate: 0.80, reactionDelayMs: 200, maxSpeed: 0.8, trackingNoise: 10, trackingTimeout: 6000,
    pid: { kp: 1.00, ki: 0.10, kd: 0.08, maxIntegral: 80, derivativeFilter: 0.4, maxControlSpeed: 600 },
    technician: { predictionAccuracy: 0.8, courseAccuracy: 0.7 }
  },
  Easy: {
    returnRate: 0.50, reactionDelayMs: 400, maxSpeed: 0.6, trackingNoise: 20, trackingTimeout: 4000,
    pid: { kp: 0.60, ki: 0.12, kd: 0.02, maxIntegral: 50, derivativeFilter: 0.3, maxControlSpeed: 400 },
    technician: { predictionAccuracy: 0.6, courseAccuracy: 0.5 }
  },
};

export const DEFAULT_NPC_CONFIG: NPCConfig = {
  enabled: false,
  player: 2,
  mode: 'heuristic',
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
