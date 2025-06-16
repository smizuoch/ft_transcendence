import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePong2ResultDto } from './dto/create-pong2-result.dto';
import { CreatePong42ResultDto } from './dto/create-pong42-result.dto';
import { QueryResultsDto } from './dto/query-results.dto';
import { 
  Pong2Result, 
  Pong42Result, 
  UserStats, 
  Pong2Stats, 
  Pong42Stats 
} from './types';

@Injectable()
export class ResultSearchService {
  constructor(private prisma: PrismaService) {}

  // Pong2結果の作成
  async createPong2Result(dto: CreatePong2ResultDto): Promise<Pong2Result> {
    const result = await this.prisma.gameResultPong2.create({
      data: {
        username: dto.username,
        opponentUsername: dto.opponentUsername,
        result: dto.result,
        gameDate: new Date(dto.gameDate),
      },
    });

    return {
      id: result.id,
      username: result.username,
      opponentUsername: result.opponentUsername,
      result: result.result as 'win' | 'lose',
      gameDate: result.gameDate.toISOString(),
    };
  }

  // Pong42結果の作成
  async createPong42Result(dto: CreatePong42ResultDto): Promise<Pong42Result> {
    const result = await this.prisma.gameResultPong42.create({
      data: {
        username: dto.username,
        rank: dto.rank,
        gameDate: new Date(dto.gameDate),
      },
    });

    return {
      id: result.id,
      username: result.username,
      rank: result.rank,
      gameDate: result.gameDate.toISOString(),
    };
  }

  // Pong2結果の取得
  async getPong2Results(username: string, query: QueryResultsDto): Promise<Pong2Result[]> {
    const results = await this.prisma.gameResultPong2.findMany({
      where: { username },
      orderBy: { gameDate: 'desc' },
      take: query.limit,
      skip: query.offset,
    });

    return results.map(result => ({
      id: result.id,
      username: result.username,
      opponentUsername: result.opponentUsername,
      result: result.result as 'win' | 'lose',
      gameDate: result.gameDate.toISOString(),
    }));
  }

  // Pong42結果の取得
  async getPong42Results(username: string, query: QueryResultsDto): Promise<Pong42Result[]> {
    const results = await this.prisma.gameResultPong42.findMany({
      where: { username },
      orderBy: { gameDate: 'desc' },
      take: query.limit,
      skip: query.offset,
    });

    return results.map(result => ({
      id: result.id,
      username: result.username,
      rank: result.rank,
      gameDate: result.gameDate.toISOString(),
    }));
  }

  // ユーザー統計情報の取得
  async getUserStats(username: string): Promise<UserStats> {
    // Pong2統計
    const pong2Results = await this.prisma.gameResultPong2.findMany({
      where: { username },
      orderBy: { gameDate: 'desc' },
    });

    const pong2Wins = pong2Results.filter(r => r.result === 'win').length;
    const pong2TotalGames = pong2Results.length;
    const pong2WinRate = pong2TotalGames > 0 ? (pong2Wins / pong2TotalGames) * 100 : 0;

    const pong2Recent = pong2Results.slice(0, 5).map(result => ({
      id: result.id,
      username: result.username,
      opponentUsername: result.opponentUsername,
      result: result.result as 'win' | 'lose',
      gameDate: result.gameDate.toISOString(),
    }));

    // Pong42統計
    const pong42Results = await this.prisma.gameResultPong42.findMany({
      where: { username },
      orderBy: { gameDate: 'desc' },
    });

    const pong42TotalGames = pong42Results.length;
    const pong42BestRank = pong42Results.length > 0 ? Math.min(...pong42Results.map(r => r.rank)) : 0;
    const pong42AverageRank = pong42Results.length > 0 
      ? pong42Results.reduce((sum, r) => sum + r.rank, 0) / pong42Results.length 
      : 0;

    const pong42Recent = pong42Results.slice(0, 5).map(result => ({
      id: result.id,
      username: result.username,
      rank: result.rank,
      gameDate: result.gameDate.toISOString(),
    }));

    const pong2Stats: Pong2Stats = {
      totalGames: pong2TotalGames,
      wins: pong2Wins,
      losses: pong2TotalGames - pong2Wins,
      winRate: Math.round(pong2WinRate * 100) / 100,
      recentGames: pong2Recent,
    };

    const pong42Stats: Pong42Stats = {
      totalGames: pong42TotalGames,
      bestRank: pong42BestRank,
      averageRank: Math.round(pong42AverageRank * 100) / 100,
      recentGames: pong42Recent,
    };

    return {
      username,
      pong2Stats,
      pong42Stats,
    };
  }
}
