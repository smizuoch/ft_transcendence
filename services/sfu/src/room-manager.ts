import { Room, PlayerInfo } from './types';

export class GameRoom implements Room {
  public id: string;
  public players: Map<string, { playerInfo: PlayerInfo; playerNumber: 1 | 2 }>;
  public createdAt: Date;
  public lastActivity: Date;

  constructor(id: string) {
    this.id = id;
    this.players = new Map();
    this.createdAt = new Date();
    this.lastActivity = new Date();
  }

  addPlayer(playerId: string, playerInfo: PlayerInfo): 1 | 2 {
    this.lastActivity = new Date();

    // 既に参加している場合は既存のプレイヤー番号を返す
    if (this.players.has(playerId)) {
      const existingPlayerNumber = this.players.get(playerId)!.playerNumber;
      console.log(`Player ${playerId} already in room ${this.id} as player ${existingPlayerNumber}`);
      return existingPlayerNumber;
    }

    // 空いているプレイヤー番号を割り当て
    const playerNumber = this.getAvailablePlayerNumber();
    if (playerNumber === null) {
      throw new Error('Room is full');
    }

    this.players.set(playerId, { playerInfo, playerNumber });
    console.log(`Added player ${playerId} to room ${this.id} as player ${playerNumber}`);
    return playerNumber;
  }

  removePlayer(playerId: string): boolean {
    this.lastActivity = new Date();
    return this.players.delete(playerId);
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  getPlayerNumber(playerId: string): 1 | 2 | null {
    const player = this.players.get(playerId);
    return player ? player.playerNumber : null;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getPlayers(): Array<{ playerId: string; playerInfo: PlayerInfo; playerNumber: 1 | 2 }> {
    return Array.from(this.players.entries()).map(([playerId, data]) => ({
      playerId,
      playerInfo: data.playerInfo,
      playerNumber: data.playerNumber
    }));
  }

  isFull(): boolean {
    return this.players.size >= 2;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  private getAvailablePlayerNumber(): 1 | 2 | null {
    const usedNumbers = new Set(Array.from(this.players.values()).map(p => p.playerNumber));

    if (!usedNumbers.has(1)) return 1;
    if (!usedNumbers.has(2)) return 2;
    return null;
  }
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  joinRoom(roomNumber: string, playerId: string, playerInfo: PlayerInfo): GameRoom {
    let room = this.rooms.get(roomNumber);

    if (!room) {
      room = new GameRoom(roomNumber);
      this.rooms.set(roomNumber, room);
      console.log(`Created new room: ${roomNumber}`);
    }

    if (room.isFull() && !room.hasPlayer(playerId)) {
      throw new Error('Room is full');
    }

    room.addPlayer(playerId, playerInfo);
    console.log(`Player ${playerId} joined room ${roomNumber} as player ${room.getPlayerNumber(playerId)}`);

    return room;
  }

  getRoom(roomNumber: string): GameRoom | undefined {
    return this.rooms.get(roomNumber);
  }

  removePlayer(playerId: string): string | null {
    for (const [roomNumber, room] of this.rooms.entries()) {
      if (room.hasPlayer(playerId)) {
        room.removePlayer(playerId);
        console.log(`Player ${playerId} left room ${roomNumber}`);

        // 部屋が空になったら削除
        if (room.isEmpty()) {
          this.rooms.delete(roomNumber);
          console.log(`Removed empty room: ${roomNumber}`);
        }

        return roomNumber;
      }
    }
    return null;
  }

  removeRoom(roomNumber: string): boolean {
    const removed = this.rooms.delete(roomNumber);
    if (removed) {
      console.log(`Removed room: ${roomNumber}`);
    }
    return removed;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getTotalPlayers(): number {
    return Array.from(this.rooms.values()).reduce((total, room) => total + room.getPlayerCount(), 0);
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
        console.log(`Cleaned up inactive room: ${roomNumber}`);
      }
    }

    return removedCount;
  }
}
