import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ResultSearchService } from './result-search.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreatePong2ResultDto } from './dto/create-pong2-result.dto';
import { CreatePong42ResultDto } from './dto/create-pong42-result.dto';
import { QueryResultsDto } from './dto/query-results.dto';
import { APIResponse } from './types';

@Controller('results')
@UseGuards(AuthGuard)
export class ResultSearchController {
  constructor(private readonly resultSearchService: ResultSearchService) {}

  // Pong2結果の作成
  @Post('pong2')
  async createPong2Result(@Body() dto: CreatePong2ResultDto): Promise<APIResponse<any>> {
    try {
      const result = await this.resultSearchService.createPong2Result(dto);
      return {
        success: true,
        data: result,
        message: 'Pong2 result created successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: 'Failed to create Pong2 result',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Pong42結果の作成
  @Post('pong42')
  async createPong42Result(@Body() dto: CreatePong42ResultDto): Promise<APIResponse<any>> {
    try {
      const result = await this.resultSearchService.createPong42Result(dto);
      return {
        success: true,
        data: result,
        message: 'Pong42 result created successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: 'Failed to create Pong42 result',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Pong2結果の取得
  @Get('pong2/:username')
  async getPong2Results(
    @Param('username') username: string,
    @Query() query: QueryResultsDto,
  ): Promise<APIResponse<any>> {
    try {
      const results = await this.resultSearchService.getPong2Results(username, query);
      return {
        success: true,
        data: results,
        message: 'Pong2 results retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve Pong2 results',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Pong42結果の取得
  @Get('pong42/:username')
  async getPong42Results(
    @Param('username') username: string,
    @Query() query: QueryResultsDto,
  ): Promise<APIResponse<any>> {
    try {
      const results = await this.resultSearchService.getPong42Results(username, query);
      return {
        success: true,
        data: results,
        message: 'Pong42 results retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve Pong42 results',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ユーザー統計情報の取得
  @Get('stats/:username')
  async getUserStats(@Param('username') username: string): Promise<APIResponse<any>> {
    try {
      const stats = await this.resultSearchService.getUserStats(username);
      return {
        success: true,
        data: stats,
        message: 'User stats retrieved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve user stats',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
