export interface GameState {
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
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

export interface PlayerInfo {
  id: string;
  avatar: string;
  name?: string;
}

export interface Room {
  id: string;
  players: Map<string, { playerInfo: PlayerInfo; playerNumber: 1 | 2 }>;
  createdAt: Date;
  lastActivity: Date;
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  timestamp: number;
}

export interface GamePong42State {
  roomId: string;
  participants: Map<string, PlayerInfo>;
  countdown: number;
  gameStarted: boolean;
  gameOver: boolean;
  npcCount: number;
  createdAt: Date;
  lastActivity: Date;
}

export interface NPCRequest {
  roomNumber: string;
  npcCount: number;
}

export interface NPCGameState {
  gameId: string;
  gameState: GameState;
  active: boolean;
}
