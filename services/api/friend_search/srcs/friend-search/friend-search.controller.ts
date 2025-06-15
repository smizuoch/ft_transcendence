import { Controller, Get, Post, Delete, Param, UseGuards, Request, Body, HttpException, HttpStatus } from '@nestjs/common';
import { FriendSearchService } from './friend-search.service';
import { FullAuthGuard } from '../auth/full-auth.guard';
import { UserProfile, FriendshipStatus } from './types';

@Controller('friend-search')
export class FriendSearchController {
  constructor(private readonly friendSearchService: FriendSearchService) {}

  // 相互フォロー（友達）一覧取得
  @UseGuards(FullAuthGuard)
  @Get('mutual-friends')
  async getMutualFriends(@Request() req): Promise<{ success: boolean; data: UserProfile[] }> {
    try {
      const username = req.user.username;
      const mutualFriends = await this.friendSearchService.getMutualFriends(username);
      
      return {
        success: true,
        data: mutualFriends,
      };
    } catch (error) {
      console.error('Failed to get mutual friends:', error);
      throw new HttpException(
        'Failed to get mutual friends',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // フォロー中ユーザー一覧取得
  @UseGuards(FullAuthGuard)
  @Get('following')
  async getFollowing(@Request() req): Promise<{ success: boolean; data: UserProfile[] }> {
    try {
      const username = req.user.username;
      const following = await this.friendSearchService.getFollowing(username);
      
      return {
        success: true,
        data: following,
      };
    } catch (error) {
      console.error('Failed to get following:', error);
      throw new HttpException(
        'Failed to get following users',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // フォロワー一覧取得
  @UseGuards(FullAuthGuard)
  @Get('followers')
  async getFollowers(@Request() req): Promise<{ success: boolean; data: UserProfile[] }> {
    try {
      const username = req.user.username;
      const followers = await this.friendSearchService.getFollowers(username);
      
      return {
        success: true,
        data: followers,
      };
    } catch (error) {
      console.error('Failed to get followers:', error);
      throw new HttpException(
        'Failed to get followers',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // フォロー実行
  @UseGuards(FullAuthGuard)
  @Post('follow')
  async followUser(@Request() req, @Body() body: { username: string }): Promise<{ success: boolean; message: string }> {
    try {
      const follower = req.user.username;
      const following = body.username;

      if (follower === following) {
        throw new HttpException(
          'Cannot follow yourself',
          HttpStatus.BAD_REQUEST
        );
      }

      await this.friendSearchService.followUser(follower, following);
      
      return {
        success: true,
        message: `Successfully followed ${following}`,
      };
    } catch (error) {
      console.error('Failed to follow user:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to follow user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // アンフォロー実行
  @UseGuards(FullAuthGuard)
  @Delete('unfollow/:username')
  async unfollowUser(@Request() req, @Param('username') username: string): Promise<{ success: boolean; message: string }> {
    try {
      const follower = req.user.username;

      if (follower === username) {
        throw new HttpException(
          'Cannot unfollow yourself',
          HttpStatus.BAD_REQUEST
        );
      }

      await this.friendSearchService.unfollowUser(follower, username);
      
      return {
        success: true,
        message: `Successfully unfollowed ${username}`,
      };
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to unfollow user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // フォロー状態確認
  @UseGuards(FullAuthGuard)
  @Get('status/:username')
  async getFollowStatus(@Request() req, @Param('username') username: string): Promise<{ success: boolean; data: FriendshipStatus }> {
    try {
      const currentUser = req.user.username;
      const status = await this.friendSearchService.getFollowStatus(currentUser, username);
      
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      console.error('Failed to get follow status:', error);
      throw new HttpException(
        'Failed to get follow status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
