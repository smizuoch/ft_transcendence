import { GamePong42State, PlayerInfo, NPCRequest } from './types';

export class GamePong42Room {
  public id: string;
  public participants: Map<string, PlayerInfo>;
  public countdown: number;
  public gameStarted: boolean;
  public gameOver: boolean;
  public npcCount: number;
  public createdAt: Date;
  public lastActivity: Date;
  private countdownTimer: NodeJS.Timeout | null = null;
  private countdownStarted: boolean = false;

  constructor(id: string) {
    this.id = id;
    this.participants = new Map();
    this.countdown = 30; // 30秒のカウントダウン
    this.gameStarted = false;
    this.gameOver = false;
    this.npcCount = 0;
    this.createdAt = new Date();
    this.lastActivity = new Date();
  }

  addParticipant(playerId: string, playerInfo: PlayerInfo): void {
    this.lastActivity = new Date();
    if (!this.participants.has(playerId)) {
      this.participants.set(playerId, playerInfo);
      console.log(`Player ${playerId} joined GamePong42 room ${this.id}`);

      // 最初の参加者でカウントダウン開始
      if (this.participants.size === 1 && !this.countdownStarted) {
        this.startCountdown();
      }
    }
  }

  removeParticipant(playerId: string): boolean {
    this.lastActivity = new Date();
    const removed = this.participants.delete(playerId);

    // 全員いなくなったらカウントダウン停止
    if (this.participants.size === 0 && this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      this.countdownStarted = false;
      this.countdown = 30;
    }

    return removed;
  }

  getParticipantCount(): number {
    return this.participants.size;
  }

  getParticipants(): Array<{ playerId: string; playerInfo: PlayerInfo }> {
    return Array.from(this.participants.entries()).map(([playerId, playerInfo]) => ({
      playerId,
      playerInfo
    }));
  }

  hasParticipant(playerId: string): boolean {
    return this.participants.has(playerId);
  }

  shouldStartGame(): boolean {
    return this.participants.size >= 42 || this.countdown <= 0; // 42人または30秒経過でゲーム開始
  }

  calculateNPCCount(): number {
    return Math.max(0, 42 - this.participants.size);
  }

  startCountdown(): void {
    if (this.countdownStarted || this.gameStarted) return;

    this.countdownStarted = true;
    console.log(`Starting countdown for room ${this.id} with ${this.participants.size} participants`);

    this.countdownTimer = setInterval(() => {
      this.countdown--;
      console.log(`Room ${this.id} countdown: ${this.countdown}`);

      if (this.shouldStartGame()) {
        this.startGame();
      }
    }, 1000);
  }

  startGame(): void {
    if (this.gameStarted) return;

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.gameStarted = true;
    this.npcCount = this.calculateNPCCount();
    console.log(`Game started in room ${this.id} with ${this.participants.size} players and ${this.npcCount} NPCs`);
  }

  getFirstParticipant(): string | null {
    const participantIds = Array.from(this.participants.keys());
    return participantIds.length > 0 ? participantIds[0] : null;
  }

  cleanup(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}

export class GamePong42Manager {
  private rooms: Map<string, GamePong42Room> = new Map();

  getOrCreateRoom(roomId: string): GamePong42Room {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new GamePong42Room(roomId));
    }
    return this.rooms.get(roomId)!;
  }

  getRoom(roomId: string): GamePong42Room | null {
    return this.rooms.get(roomId) || null;
  }

  removeRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (room) {
      room.cleanup();
      return this.rooms.delete(roomId);
    }
    return false;
  }

  addParticipant(roomId: string, playerId: string, playerInfo: PlayerInfo): GamePong42Room {
    const room = this.getOrCreateRoom(roomId);
    room.addParticipant(playerId, playerInfo);
    return room;
  }

  removeParticipant(roomId: string, playerId: string): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;

    const removed = room.removeParticipant(playerId);

    // 部屋が空になったら削除
    if (room.getParticipantCount() === 0) {
      this.removeRoom(roomId);
    }

    return removed;
  }

  getAllRooms(): GamePong42Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  cleanup(): void {
    for (const room of this.rooms.values()) {
      room.cleanup();
    }
    this.rooms.clear();
  }
}
