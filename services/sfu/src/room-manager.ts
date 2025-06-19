import { Room, PlayerInfo } from './types';

// 型定義の問題回避
declare const process: any;

// デバッグログ用のヘルパー関数
const isDebugMode = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

const debugLog = (message: string) => {
  if (isDebugMode) {
    console.log(`[DEBUG] ${message}`);
  }
};

const errorLog = (message: string) => {
  console.error(`[ERROR] ${message}`);
};

const warnLog = (message: string) => {
  console.warn(`[WARN] ${message}`);
};

export class GameRoom implements Room {
  public id: string;
  public players: Map<string, { playerInfo: PlayerInfo; playerNumber: 1 | 2 }>;
  public spectators: Map<string, { playerInfo: PlayerInfo; joinedAt: Date }>; // 観戦者を追加
  public createdAt: Date;
  public lastActivity: Date;

  // ゲーム状態の管理
  public gameStarted: boolean = false;
  public scores: { player1: number; player2: number } = { player1: 0, player2: 0 };
  public gameOver: boolean = false;
  public winner: number | null = null;

  constructor(id: string) {
    this.id = id;
    this.players = new Map();
    this.spectators = new Map(); // 観戦者マップを初期化
    this.createdAt = new Date();
    this.lastActivity = new Date();
  }

  addPlayer(playerId: string, playerInfo: PlayerInfo): 1 | 2 | 'spectator' {
    this.lastActivity = new Date();

    // 既に参加している場合は既存のプレイヤー番号を返す
    if (this.players.has(playerId)) {
      const existingPlayerNumber = this.players.get(playerId)!.playerNumber;
      debugLog(`Player ${playerId} already in room ${this.id} as player ${existingPlayerNumber}`);
      return existingPlayerNumber;
    }

    // 既に観戦者として参加している場合
    if (this.spectators.has(playerId)) {
      debugLog(`Player ${playerId} already in room ${this.id} as spectator`);
      return 'spectator';
    }

    // 空いているプレイヤー番号を割り当て
    const playerNumber = this.getAvailablePlayerNumber();
    if (playerNumber === null) {
      // プレイヤー枠が満杯の場合は観戦者として追加
      this.spectators.set(playerId, { playerInfo, joinedAt: new Date() });
      debugLog(`Added player ${playerId} to room ${this.id} as spectator`);
      return 'spectator';
    }

    this.players.set(playerId, { playerInfo, playerNumber });
    debugLog(`Added player ${playerId} to room ${this.id} as player ${playerNumber}`);
    return playerNumber;
  }

  removePlayer(playerId: string): boolean {
    this.lastActivity = new Date();
    // プレイヤーと観戦者の両方から削除を試行
    const removedFromPlayers = this.players.delete(playerId);
    const removedFromSpectators = this.spectators.delete(playerId);
    return removedFromPlayers || removedFromSpectators;
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId) || this.spectators.has(playerId);
  }

  getPlayerNumber(playerId: string): 1 | 2 | 'spectator' | null {
    const player = this.players.get(playerId);
    if (player) return player.playerNumber;
    
    if (this.spectators.has(playerId)) return 'spectator';
    
    return null;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getSpectatorCount(): number {
    return this.spectators.size;
  }

  getTotalParticipants(): number {
    return this.players.size + this.spectators.size;
  }

  getPlayers(): Array<{ playerId: string; playerInfo: PlayerInfo; playerNumber: 1 | 2 }> {
    return Array.from(this.players.entries()).map(([playerId, data]) => ({
      playerId,
      playerInfo: data.playerInfo,
      playerNumber: data.playerNumber
    }));
  }

  getSpectators(): Array<{ playerId: string; playerInfo: PlayerInfo; joinedAt: Date }> {
    return Array.from(this.spectators.entries()).map(([playerId, data]) => ({
      playerId,
      playerInfo: data.playerInfo,
      joinedAt: data.joinedAt
    }));
  }

  getAllParticipants(): {
    players: Array<{ playerId: string; playerInfo: PlayerInfo; playerNumber: 1 | 2 }>;
    spectators: Array<{ playerId: string; playerInfo: PlayerInfo; joinedAt: Date }>;
  } {
    return {
      players: this.getPlayers(),
      spectators: this.getSpectators()
    };
  }

  isFull(): boolean {
    return this.players.size >= 2;
  }

  isEmpty(): boolean {
    return this.players.size === 0 && this.spectators.size === 0;
  }

  private getAvailablePlayerNumber(): 1 | 2 | null {
    const usedNumbers = new Set(Array.from(this.players.values()).map(p => p.playerNumber));

    if (!usedNumbers.has(1)) return 1;
    if (!usedNumbers.has(2)) return 2;
    return null;
  }

  // ゲーム管理メソッド
  startGame(): void {
    this.gameStarted = true;
    this.gameOver = false;
    this.scores = { player1: 0, player2: 0 };
    this.winner = null;
    this.lastActivity = new Date();
  }

  updateScore(scorer: 'player1' | 'player2', winningScore: number = 11): boolean {
    this.scores[scorer]++;
    this.lastActivity = new Date();
    
    // ゲーム終了判定
    if (this.scores[scorer] >= winningScore) {
      this.gameOver = true;
      this.winner = scorer === 'player1' ? 1 : 2;
      return true; // ゲーム終了
    }
    
    return false; // ゲーム継続
  }

  getGameState(): {
    gameStarted: boolean;
    scores: { player1: number; player2: number };
    gameOver: boolean;
    winner: number | null;
  } {
    return {
      gameStarted: this.gameStarted,
      scores: this.scores,
      gameOver: this.gameOver,
      winner: this.winner
    };
  }

  resetGame(): void {
    this.gameStarted = false;
    this.gameOver = false;
    this.scores = { player1: 0, player2: 0 };
    this.winner = null;
    this.lastActivity = new Date();
    debugLog(`Game reset in room ${this.id}`);
  }
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  joinRoom(roomNumber: string, playerId: string, playerInfo: PlayerInfo): { room: GameRoom; role: 1 | 2 | 'spectator' } {
    let room = this.rooms.get(roomNumber);

    if (!room) {
      room = new GameRoom(roomNumber);
      this.rooms.set(roomNumber, room);
      debugLog(`Created new room: ${roomNumber}`);
    }

    const role = room.addPlayer(playerId, playerInfo);
    debugLog(`Player ${playerId} joined room ${roomNumber} as ${role === 'spectator' ? 'spectator' : `player ${role}`}`);

    return { room, role };
  }

  getRoom(roomNumber: string): GameRoom | undefined {
    return this.rooms.get(roomNumber);
  }

  removePlayer(playerId: string): string | null {
    for (const [roomNumber, room] of this.rooms.entries()) {
      if (room.hasPlayer(playerId)) {
        room.removePlayer(playerId);
        debugLog(`Player ${playerId} left room ${roomNumber}`);

        // 部屋が空になったら削除
        if (room.isEmpty()) {
          this.rooms.delete(roomNumber);
          debugLog(`Removed empty room: ${roomNumber}`);
        }

        return roomNumber;
      }
    }
    return null;
  }

  removeRoom(roomNumber: string): boolean {
    const removed = this.rooms.delete(roomNumber);
    if (removed) {
      debugLog(`Removed room: ${roomNumber}`);
    }
    return removed;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getTotalPlayers(): number {
    return Array.from(this.rooms.values()).reduce((total, room) => total + room.getTotalParticipants(), 0);
  }

  // 非アクティブな部屋をクリーンアップ
  cleanupInactiveRooms(timeoutMs: number = 30 * 60 * 1000): number { // 30分でタイムアウト
    const now = new Date();
    let removedCount = 0;

    for (const [roomNumber, room] of this.rooms.entries()) {
      const timeSinceLastActivity = now.getTime() - room.lastActivity.getTime();

      if (timeSinceLastActivity > timeoutMs) {
        this.rooms.delete(roomNumber);
        removedCount++;
        debugLog(`Cleaned up inactive room: ${roomNumber}`);
      }
    }

    return removedCount;
  }
}
