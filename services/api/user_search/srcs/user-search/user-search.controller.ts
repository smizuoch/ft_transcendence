import { Controller, Get, Put, Param, UseGuards, Request, Body, HttpException, HttpStatus } from '@nestjs/common';
import { UserSearchService } from './user-search.service';
import { FullAuthGuard } from '../auth/full-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user-search')
export class UserSearchController {
  constructor(private readonly userSearchService: UserSearchService) {}

  // 自分の情報取得（JWTからユーザー名を取得）
  @UseGuards(FullAuthGuard)
  @Get('me')
  async getMyProfile(@Request() req) {
    try {
      const username = req.user.username;
      const userProfile = await this.userSearchService.findUserProfile(username);
      
      return {
        success: true,
        data: {
          username: userProfile.username,
          profileImage: userProfile.profileImage,
          isOnline: userProfile.isOnline,
        },
      };
    } catch (error) {
      if (error.status === 404) {
        // プロフィールが存在しない場合は作成
        const username = req.user.username;
        const newProfile = await this.userSearchService.createOrUpdateUserProfile(username);
        return {
          success: true,
          data: {
            username: newProfile.username,
            profileImage: newProfile.profileImage,
            isOnline: newProfile.isOnline,
          },
        };
      }
      throw new HttpException('Failed to get user profile', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 特定ユーザーの情報取得
  @UseGuards(FullAuthGuard)
  @Get('profile/:username')
  async getUserProfile(@Param('username') username: string) {
    try {
      const userProfile = await this.userSearchService.findUserProfile(username);
      
      return {
        success: true,
        data: {
          username: userProfile.username,
          profileImage: userProfile.profileImage,
          isOnline: userProfile.isOnline,
        },
      };
    } catch (error) {
      if (error.status === 404) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to get user profile', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // オンライン状態更新
  @UseGuards(FullAuthGuard)
  @Put('status')
  async updateOnlineStatus(@Request() req, @Body() body: { isOnline: boolean }) {
    try {
      const username = req.user.username;
      const userProfile = await this.userSearchService.updateOnlineStatus(username, body.isOnline);
      
      return {
        success: true,
        data: {
          username: userProfile.username,
          profileImage: userProfile.profileImage,
          isOnline: userProfile.isOnline,
        },
      };
    } catch (error) {
      throw new HttpException('Failed to update online status', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
