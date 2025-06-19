export interface Pong2Result {
  id: number;
  username: string;
  opponentUsername: string;
  result: 'win' | 'lose';
  gameDate: string;
}

export interface Pong42Result {
  id: number;
  username: string;
  rank: number;
  gameDate: string;
}

export interface Pong2Stats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  recentGames: Pong2Result[];
}

export interface Pong42Stats {
  totalGames: number;
  bestRank: number;
  averageRank: number;
  recentGames: Pong42Result[];
}

export interface UserStats {
  username: string;
  pong2Stats: Pong2Stats;
  pong42Stats: Pong42Stats;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: any;
  timestamp: string;
}