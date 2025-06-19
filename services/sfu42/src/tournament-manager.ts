import { PlayerInfo } from './types';
import { GameRoom } from './room-manager';

export enum TournamentStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface TournamentPlayer {
  playerId: string;
  playerInfo: PlayerInfo;
  seedPosition: number;
}

export interface TournamentMatch {
  id: string;
  round: number;
  matchNumber: number;
  player1?: TournamentPlayer;
  player2?: TournamentPlayer;
  winner?: TournamentPlayer;
  gameRoom?: GameRoom;
  roomNumber?: string;
  status: 'waiting' | 'in_progress' | 'completed';
}

export interface Tournament {
  id: string;
  maxPlayers: number;
  players: TournamentPlayer[];
  bracket: TournamentMatch[][];
  status: TournamentStatus;
  createdAt: Date;
  completedAt?: Date;
  winner?: TournamentPlayer;
  currentRound: number;
  spectators: Map<string, { playerInfo: PlayerInfo; joinedAt: Date }>;
}

export class TournamentManager {
  private tournaments: Map<string, Tournament> = new Map();

  /**
   * 新しいトーナメントを作成
   */
  createTournament(tournamentId: string, maxPlayers: number): Tournament {
    if (![2, 4, 8].includes(maxPlayers)) {
      throw new Error('Tournament supports only 2, 4, or 8 players');
    }

    const tournament: Tournament = {
      id: tournamentId,
      maxPlayers,
      players: [],
      bracket: [],
      status: TournamentStatus.WAITING,
      createdAt: new Date(),
      currentRound: 0,
      spectators: new Map()
    };

    this.tournaments.set(tournamentId, tournament);
    return tournament;
  }

  /**
   * トーナメントにプレイヤーを追加
   */
  addPlayer(tournamentId: string, playerId: string, playerInfo: PlayerInfo): 'player' | 'spectator' {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status !== TournamentStatus.WAITING) {
      throw new Error('Tournament is not accepting new players');
    }

    // 既に参加済みかチェック
    if (tournament.players.some(p => p.playerId === playerId)) {
      return 'player';
    }

    if (tournament.spectators.has(playerId)) {
      return 'spectator';
    }

    // プレイヤー枠がある場合
    if (tournament.players.length < tournament.maxPlayers) {
      const seedPosition = tournament.players.length + 1;
      const tournamentPlayer: TournamentPlayer = {
        playerId,
        playerInfo,
        seedPosition
      };

      tournament.players.push(tournamentPlayer);
      return 'player';
    } else {
      // プレイヤー枠が満杯の場合は観戦者として追加
      tournament.spectators.set(playerId, { playerInfo, joinedAt: new Date() });
      return 'spectator';
    }
  }

  /**
   * トーナメントを開始してブラケットを生成
   */
  startTournament(tournamentId: string): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status !== TournamentStatus.WAITING) {
      return false;
    }

    const playerCount = tournament.players.length;
    if (![2, 4, 8].includes(playerCount)) {
      throw new Error(`Invalid player count: ${playerCount}. Expected 2, 4, or 8 players`);
    }

    // ブラケット生成
    tournament.bracket = this.generateBracket(tournament.players, tournamentId);
    tournament.status = TournamentStatus.IN_PROGRESS;
    tournament.currentRound = 1;

    return true;
  }

  /**
   * ブラケット生成（シングルエリミネーション）
   */
  private generateBracket(players: TournamentPlayer[], tournamentId: string): TournamentMatch[][] {
    const playerCount = players.length;
    const rounds: TournamentMatch[][] = [];

    // プレイヤーをランダムシャッフル
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

    // 初回戦を作成
    const firstRound: TournamentMatch[] = [];
    for (let i = 0; i < playerCount; i += 2) {
      const roomNumber = `${tournamentId}-r1-m${i / 2 + 1}`;
      const match: TournamentMatch = {
        id: `match-1-${i / 2 + 1}`,
        round: 1,
        matchNumber: i / 2 + 1,
        player1: shuffledPlayers[i],
        player2: shuffledPlayers[i + 1],
        roomNumber,
        status: 'waiting'
      };
      firstRound.push(match);
    }
    rounds.push(firstRound);

    // 後続ラウンドを作成
    let currentRoundMatches = firstRound.length;
    let roundNumber = 2;

    while (currentRoundMatches > 1) {
      const nextRound: TournamentMatch[] = [];
      const nextRoundMatches = Math.floor(currentRoundMatches / 2);

      for (let i = 0; i < nextRoundMatches; i++) {
        const match: TournamentMatch = {
          id: `match-${roundNumber}-${i + 1}`,
          round: roundNumber,
          matchNumber: i + 1,
          status: 'waiting'
        };
        nextRound.push(match);
      }

      rounds.push(nextRound);
      currentRoundMatches = nextRoundMatches;
      roundNumber++;
    }

    return rounds;
  }

  /**
   * 試合結果を記録して次のラウンドに進める
   */
  recordMatchResult(tournamentId: string, matchId: string, winnerId: string): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.status !== TournamentStatus.IN_PROGRESS) {
      return false;
    }

    // 試合を見つける
    let match: TournamentMatch | undefined;
    let roundIndex = -1;
    let matchIndex = -1;

    for (let r = 0; r < tournament.bracket.length; r++) {
      for (let m = 0; m < tournament.bracket[r].length; m++) {
        if (tournament.bracket[r][m].id === matchId) {
          match = tournament.bracket[r][m];
          roundIndex = r;
          matchIndex = m;
          break;
        }
      }
      if (match) break;
    }

    if (!match) {
      return false;
    }

    if (match.status === 'completed') {
      return false; // 既に完了している試合は再処理しない
    }

    // 勝者を決定
    const winner = match.player1?.playerId === winnerId ? match.player1 : match.player2;
    if (!winner) {
      return false;
    }

    // 試合結果を記録
    match.winner = winner;
    match.status = 'completed';

    // 次のラウンドに勝者を進める
    if (roundIndex + 1 < tournament.bracket.length) {
      const nextRound = tournament.bracket[roundIndex + 1];
      const nextMatchIndex = Math.floor(matchIndex / 2);
      const nextMatch = nextRound[nextMatchIndex];

      if (!nextMatch.player1) {
        nextMatch.player1 = winner;
      } else if (!nextMatch.player2) {
        nextMatch.player2 = winner;

        // 両プレイヤーが揃ったら試合準備
        nextMatch.status = 'waiting';
        nextMatch.roomNumber = `${tournament.id}-r${roundIndex + 2}-m${nextMatchIndex + 1}`;
      }
    }

    // トーナメント終了チェック
    this.checkTournamentCompletion(tournament);

    return true;
  }

  /**
   * トーナメント完了チェック
   */
  private checkTournamentCompletion(tournament: Tournament): void {
    const finalRound = tournament.bracket[tournament.bracket.length - 1];
    if (finalRound.length === 1 && finalRound[0].status === 'completed') {
      tournament.status = TournamentStatus.COMPLETED;
      tournament.winner = finalRound[0].winner;
      tournament.completedAt = new Date();
    }
  }

  /**
   * 現在のラウンドの待機中の試合を取得
   */
  getWaitingMatches(tournamentId: string): TournamentMatch[] {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.status !== TournamentStatus.IN_PROGRESS) {
      return [];
    }

    const matches: TournamentMatch[] = [];
    for (const round of tournament.bracket) {
      for (const match of round) {
        if (match.status === 'waiting' && match.player1 && match.player2) {
          matches.push(match);
        }
      }
    }

    return matches;
  }

  /**
   * トーナメント情報を取得
   */
  getTournament(tournamentId: string): Tournament | undefined {
    return this.tournaments.get(tournamentId);
  }

  /**
   * 全トーナメントを取得
   */
  getAllTournaments(): Tournament[] {
    return Array.from(this.tournaments.values());
  }

  /**
   * トーナメントを削除
   */
  deleteTournament(tournamentId: string): boolean {
    return this.tournaments.delete(tournamentId);
  }

  /**
   * プレイヤーが参加しているトーナメントを検索
   */
  findTournamentByPlayer(playerId: string): Tournament | undefined {
    for (const tournament of this.tournaments.values()) {
      if (tournament.players.some(p => p.playerId === playerId)) {
        return tournament;
      }
    }
    return undefined;
  }

  /**
   * トーナメントの進行状況を取得
   */
  getTournamentProgress(tournamentId: string): {
    totalMatches: number;
    completedMatches: number;
    progressPercentage: number;
  } | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      return null;
    }

    let totalMatches = 0;
    let completedMatches = 0;

    for (const round of tournament.bracket) {
      for (const match of round) {
        totalMatches++;
        if (match.status === 'completed') {
          completedMatches++;
        }
      }
    }

    return {
      totalMatches,
      completedMatches,
      progressPercentage: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
    };
  }

  /**
   * 観戦者をトーナメントに追加
   */
  addSpectator(tournamentId: string, playerId: string, playerInfo: PlayerInfo): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // 既にプレイヤーとして参加している場合は追加しない
    if (tournament.players.some(p => p.playerId === playerId)) {
      return false;
    }

    // 既に観戦者として参加している場合
    if (tournament.spectators.has(playerId)) {
      return true;
    }

    tournament.spectators.set(playerId, { playerInfo, joinedAt: new Date() });
    return true;
  }

  /**
   * トーナメントから参加者を削除
   */
  removeParticipant(tournamentId: string, playerId: string): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      return false;
    }

    // プレイヤーとして参加している場合
    const playerIndex = tournament.players.findIndex(p => p.playerId === playerId);
    if (playerIndex !== -1) {
      tournament.players.splice(playerIndex, 1);
      return true;
    }

    // 観戦者として参加している場合
    return tournament.spectators.delete(playerId);
  }

  /**
   * 待機中の試合を取得（次に開始すべき試合）
   */
  getNextMatches(tournamentId: string): TournamentMatch[] {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.status !== TournamentStatus.IN_PROGRESS) {
      return [];
    }

    // 現在のラウンドで待機中かつ両プレイヤーが揃っている試合を返す
    if (tournament.currentRound > 0 && tournament.currentRound <= tournament.bracket.length) {
      const currentRound = tournament.bracket[tournament.currentRound - 1];
      return currentRound.filter(match =>
        match.status === 'waiting' && match.player1 && match.player2
      );
    }

    return [];
  }

  /**
   * トーナメントの現在のラウンドを進める
   */
  advanceRound(tournamentId: string): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.status !== TournamentStatus.IN_PROGRESS) {
      return false;
    }

    // 現在のラウンドの全試合が完了したかチェック
    if (tournament.currentRound > 0 && tournament.currentRound <= tournament.bracket.length) {
      const currentRound = tournament.bracket[tournament.currentRound - 1];
      const allCompleted = currentRound.every(match => match.status === 'completed');

      if (allCompleted && tournament.currentRound < tournament.bracket.length) {
        tournament.currentRound++;

        // 次のラウンドの試合を準備
        this.prepareNextRoundMatches(tournament);
        return true;
      }
    }

    return false;
  }

  /**
   * 次のラウンドの試合を準備する
   */
  private prepareNextRoundMatches(tournament: Tournament): void {
    if (tournament.currentRound > 0 && tournament.currentRound <= tournament.bracket.length) {
      const nextRound = tournament.bracket[tournament.currentRound - 1];

      // 各試合に部屋番号を割り当て、ステータスを更新
      nextRound.forEach((match, index) => {
        if (match.player1 && match.player2 && match.status !== 'in_progress') {
          match.roomNumber = `${tournament.id}-r${tournament.currentRound}-m${index + 1}`;
          match.status = 'waiting';
        }
      });
    }
  }

  /**
   * トーナメントの全参加者を取得（プレイヤー + 観戦者）
   */
  getAllParticipants(tournamentId: string): {
    players: TournamentPlayer[];
    spectators: Array<{ playerId: string; playerInfo: PlayerInfo; joinedAt: Date }>;
  } | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      return null;
    }

    return {
      players: tournament.players,
      spectators: Array.from(tournament.spectators.entries()).map(([playerId, data]) => ({
        playerId,
        playerInfo: data.playerInfo,
        joinedAt: data.joinedAt
      }))
    };
  }

  /**
   * 特定の試合を取得
   */
  getMatch(tournamentId: string, matchId: string): TournamentMatch | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      return null;
    }

    for (const round of tournament.bracket) {
      for (const match of round) {
        if (match.id === matchId) {
          return match;
        }
      }
    }

    return null;
  }

  /**
   * プレイヤーの現在の試合を取得
   */
  getPlayerCurrentMatch(tournamentId: string, playerId: string): TournamentMatch | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.status !== TournamentStatus.IN_PROGRESS) {
      return null;
    }

    // 現在のラウンドでプレイヤーが参加している試合を探す
    const currentRound = tournament.bracket[tournament.currentRound - 1];
    if (!currentRound) return null;

    for (const match of currentRound) {
      if ((match.player1?.playerId === playerId || match.player2?.playerId === playerId) &&
          match.status !== 'completed') {
        return match;
      }
    }

    return null;
  }

  /**
   * 試合の参加プレイヤーIDを取得
   */
  getMatchPlayers(tournamentId: string, matchId: string): string[] {
    const match = this.getMatch(tournamentId, matchId);
    if (!match) {
      return [];
    }

    const playerIds: string[] = [];
    if (match.player1?.playerId) {
      playerIds.push(match.player1.playerId);
    }
    if (match.player2?.playerId) {
      playerIds.push(match.player2.playerId);
    }

    return playerIds;
  }
}
