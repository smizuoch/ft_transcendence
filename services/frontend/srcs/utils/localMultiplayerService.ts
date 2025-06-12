export interface LocalClient {
  id: string;
  name: string;
  num_of_play: number;
  stillAlive: boolean;
  avatar: string;
}

export interface TournamentMatch {
  player1: LocalClient;
  player2: LocalClient;
  roomNumber: string;
  completed: boolean;
  winner: LocalClient | null;
}

export interface TournamentBracket {
  initialRoomNumber: string;
  semifinal1: TournamentMatch;
  semifinal2: TournamentMatch;
  final: TournamentMatch | null;
  currentMatch: 'semifinal1' | 'semifinal2' | 'final' | 'completed';
}

export interface LocalRoomState {
  roomNumber: string;
  clients: LocalClient[];
  players: LocalClient[];
  spectators: LocalClient[];
  gameStarted: boolean;
  gameOver: boolean;
  winner: number | null;
  tournament?: TournamentBracket;
}

export class LocalMultiplayerService {
  private static instance: LocalMultiplayerService | null = null;
  private roomState: LocalRoomState | null = null;
  private eventListeners: { [event: string]: Function[] } = {};
  private isConnected: boolean = false;
  private static occupiedRooms: Set<string> = new Set();

  constructor() {
    if (LocalMultiplayerService.instance) {
      return LocalMultiplayerService.instance;
    }
    LocalMultiplayerService.instance = this;
  }

  on(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(
        cb => cb !== callback
      );
    }
  }

  private emit(event: string, data?: any) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  setupLocalMultiplayer(roomNumber: string, clients: LocalClient[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (LocalMultiplayerService.occupiedRooms.has(roomNumber)) {
        reject(new Error(`部屋番号 ${roomNumber} は既に使用中です`));
        return;
      }

      LocalMultiplayerService.occupiedRooms.add(roomNumber);

      this.roomState = {
        roomNumber,
        clients: [...clients],
        players: [],
        spectators: [],
        gameStarted: false,
        gameOver: false,
        winner: null,
      };

      if (clients.length === 4) {
        this.setupTournamentBracket(roomNumber, clients);
      } else {
        if (clients.length % 2 === 1) {
          const npcClient: LocalClient = {
            id: 'npc-technician',
            name: 'TechnicianNPC',
            num_of_play: 0,
            stillAlive: true,
            avatar: '/images/avatar/npc_avatar.png',
          };
          this.roomState.clients.push(npcClient);
        }
      }

      this.isConnected = true;
      this.assignPlayersAndSpectators();
      this.emit('localRoomJoined', this.roomState);
      resolve();
    });
  }

  private setupTournamentBracket(roomNumber: string, clients: LocalClient[]) {
    if (!this.roomState || clients.length !== 4) return;

    const shuffledClients = [...clients].sort(() => Math.random() - 0.5);

    const tournament: TournamentBracket = {
      initialRoomNumber: roomNumber,
      semifinal1: {
        player1: shuffledClients[0],
        player2: shuffledClients[1],
        roomNumber: roomNumber,
        completed: false,
        winner: null,
      },
      semifinal2: {
        player1: shuffledClients[2],
        player2: shuffledClients[3],
        roomNumber: (parseInt(roomNumber) + 1000000).toString(),
        completed: false,
        winner: null,
      },
      final: null,
      currentMatch: 'semifinal1',
    };

    this.roomState.tournament = tournament;
    console.log('Tournament bracket created:', tournament);
  }

  private assignPlayersAndSpectators() {
    if (!this.roomState) return;

    if (this.roomState.tournament) {
      this.assignTournamentPlayers();
      return;
    }

    this.roomState.players = this.roomState.clients
      .filter(client => client.stillAlive)
      .slice(0, 2);

    this.roomState.spectators = this.roomState.clients.filter(
      client => !this.roomState!.players.includes(client)
    );

    console.log('Players assigned:', {
      players: this.roomState.players.map(p => p.name),
      spectators: this.roomState.spectators.map(s => s.name),
    });
  }

  private assignTournamentPlayers() {
    if (!this.roomState?.tournament) return;

    const tournament = this.roomState.tournament;
    let currentMatch: TournamentMatch | null = null;

    switch (tournament.currentMatch) {
      case 'semifinal1':
        currentMatch = tournament.semifinal1;
        break;
      case 'semifinal2':
        currentMatch = tournament.semifinal2;
        break;
      case 'final':
        currentMatch = tournament.final;
        break;
    }

    if (currentMatch) {
      this.roomState.players = [currentMatch.player1, currentMatch.player2];
      this.roomState.spectators = this.roomState.clients.filter(
        client => !this.roomState!.players.includes(client)
      );
    }

    console.log('Tournament players assigned:', {
      currentMatch: tournament.currentMatch,
      players: this.roomState.players.map(p => p.name),
      spectators: this.roomState.spectators.map(s => s.name),
    });
  }

  onGameEnd(winner: 1 | 2) {
    if (!this.roomState) return;

    console.log('Game end called with winner:', winner);

    this.roomState.gameOver = true;
    this.roomState.winner = winner;

    const winnerPlayer = this.roomState.players[winner - 1];
    const loserPlayer = this.roomState.players[winner === 1 ? 1 : 0];

    console.log('Game ended:', {
      winner: winnerPlayer?.name,
      loser: loserPlayer?.name,
      stillAliveCount: this.roomState.clients.filter(c => c.stillAlive).length,
    });

    if (this.roomState.tournament) {
      this.processTournamentResult(winnerPlayer);
    }

    if (loserPlayer) {
      loserPlayer.stillAlive = false;
    }

    this.emit('localGameEnded', {
      winner,
      winnerPlayer,
      loserPlayer,
      finalScores: { player1: winner === 1 ? 3 : 0, player2: winner === 2 ? 3 : 0 },
      roomState: this.roomState,
    });
  }

  private processTournamentResult(winner: LocalClient) {
    if (!this.roomState?.tournament) return;

    const tournament = this.roomState.tournament;

    switch (tournament.currentMatch) {
      case 'semifinal1':
        tournament.semifinal1.completed = true;
        tournament.semifinal1.winner = winner;
        tournament.currentMatch = 'semifinal2';
        console.log('Semifinal 1 completed, proceeding to semifinal 2');
        break;

      case 'semifinal2':
        tournament.semifinal2.completed = true;
        tournament.semifinal2.winner = winner;
        
        if (tournament.semifinal1.winner) {
          tournament.final = {
            player1: tournament.semifinal1.winner,
            player2: winner,
            roomNumber: tournament.initialRoomNumber,
            completed: false,
            winner: null,
          };
          tournament.currentMatch = 'final';
          console.log('Semifinal 2 completed, proceeding to final');
        }
        break;

      case 'final':
        if (tournament.final) {
          tournament.final.completed = true;
          tournament.final.winner = winner;
          tournament.currentMatch = 'completed';
          console.log('Tournament completed, winner:', winner.name);
        }
        break;
    }
  }

  proceedToNext(): { action: 'nextGame' | 'result'; roomNumber?: string; roomState?: LocalRoomState } {
    if (!this.roomState) return { action: 'result' };

    const stillAliveClients = this.roomState.clients.filter(c =>
      c.id !== 'npc-technician' && c.stillAlive
    );

    console.log('Proceeding to next game:', {
      stillAliveCount: stillAliveClients.length,
      totalClients: this.roomState.clients.length,
      currentRoomNumber: this.roomState.roomNumber,
      tournament: this.roomState.tournament,
      allClients: this.roomState.clients.map(c => ({
        name: c.name,
        stillAlive: c.stillAlive,
      })),
    });

    if (stillAliveClients.length <= 1) {
      console.log('Tournament/Game completed - cleaning up room');
      
      const currentRoomNumber = this.roomState.roomNumber;
      LocalMultiplayerService.occupiedRooms.delete(currentRoomNumber);
      
      return { action: 'result' };
    }

    if (this.roomState.tournament) {
      const tournament = this.roomState.tournament;
      let nextRoomNumber = this.roomState.roomNumber;

      switch (tournament.currentMatch) {
        case 'semifinal2':
          nextRoomNumber = tournament.semifinal2.roomNumber;
          break;
        case 'final':
          nextRoomNumber = tournament.initialRoomNumber;
          break;
      }

      const nextRoomState: LocalRoomState = {
        ...this.roomState,
        roomNumber: nextRoomNumber,
        gameStarted: false,
        gameOver: false,
        winner: null,
      };

      return {
        action: 'nextGame',
        roomNumber: nextRoomNumber,
        roomState: nextRoomState,
      };
    }

    if (stillAliveClients.length >= 2) {
      if (this.roomState.roomNumber) {
        LocalMultiplayerService.occupiedRooms.delete(this.roomState.roomNumber);
      }

      return { action: 'nextGame', roomState: this.roomState };
    }

    return { action: 'result' };
  }

  isInLocalRoom(): boolean {
    return this.roomState !== null;
  }

  getRoomState(): LocalRoomState | null {
    return this.roomState;
  }

  getRoomNumber(): string | null {
    return this.roomState?.roomNumber || null;
  }

  isConnectedToLocal(): boolean {
    return this.isConnected;
  }

  leaveLocalRoom() {
    if (this.roomState?.roomNumber) {
      LocalMultiplayerService.occupiedRooms.delete(this.roomState.roomNumber);
    }
    this.roomState = null;
    this.isConnected = false;
    this.emit('localRoomLeft');
  }

  setupNextGame(roomState: LocalRoomState): Promise<void> {
    return new Promise((resolve, reject) => {
      if (LocalMultiplayerService.occupiedRooms.has(roomState.roomNumber)) {
        reject(new Error(`部屋番号 ${roomState.roomNumber} は既に使用中です`));
        return;
      }

      LocalMultiplayerService.occupiedRooms.add(roomState.roomNumber);
      this.roomState = { ...roomState };
      this.isConnected = true;

      this.assignPlayersAndSpectators();
      this.emit('localRoomJoined', this.roomState);
      resolve();
    });
  }

  getLocalPlayer(index: 1 | 2): LocalClient | null {
    if (!this.roomState) return null;
    return this.roomState.players[index - 1] || null;
  }

  hasNPC(): boolean {
    if (!this.roomState) return false;
    return this.roomState.clients.some(client => client.id === 'npc-technician');
  }
}

export const localMultiplayerService = new LocalMultiplayerService();
