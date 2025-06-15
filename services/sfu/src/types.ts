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

// GamePong42用の詳細ゲーム状態
export interface GamePong42GameState {
  // メインゲーム状態（プレイヤー vs pidNPC）
  mainGame: {
    ball: { x: number; y: number; vx: number; vy: number };
    player: { x: number; y: number; score: number };
    pidNPC: { x: number; y: number; score: number };
    gameStarted: boolean;
    gameOver: boolean;
    winner: 'player' | 'pidNPC' | null;
  };

  // サイドゲーム状態（最大41個のミニゲーム）
  sideGames: Array<{
    id: number;
    ball: { x: number; y: number; vx: number; vy: number };
    player1: { x: number; y: number; score: number; type: 'npc' | 'player'; name?: string };
    player2: { x: number; y: number; score: number; type: 'npc' | 'player'; name?: string };
    gameStarted: boolean;
    gameOver: boolean;
    winner: 1 | 2 | null;
    active: boolean;
  }>;

  // ルーム全体の状態
  roomState: {
    participantCount: number;
    npcCount: number;
    survivors: number;
    gameStarted: boolean;
    gameOver: boolean;
    countdown: number; // countdownプロパティを追加
    timestamp: number;
  };
}

// プレイヤー入力データ
export interface GamePong42Input {
  playerId: string;
  input: {
    up: boolean;
    down: boolean;
    attack?: number; // 攻撃対象のサイドゲームID
  };
  timestamp: number;
}

// ゲーム更新データ（WebRTCデータチャンネル経由で送信）
export interface GamePong42Update {
  type: 'gameState' | 'playerInput' | 'gameEvent' | 'roomState'; // 'roomState'を追加
  data: GamePong42GameState | GamePong42Input | GamePong42Event | GamePong42RoomState; // GamePong42RoomStateを追加
  timestamp: number;
}

// ルーム状態専用の型定義
export interface GamePong42RoomState {
  roomState: {
    participantCount: number;
    npcCount: number;
    survivors: number;
    gameStarted: boolean;
    gameOver: boolean;
    countdown: number;
    timestamp: number;
  };
}

// ゲームイベント
export interface GamePong42Event {
  type: 'playerJoined' | 'playerLeft' | 'gameStarted' | 'gameOver' | 'playerEliminated' | 'attack';
  playerId?: string;
  data?: any;
  timestamp: number;
}
