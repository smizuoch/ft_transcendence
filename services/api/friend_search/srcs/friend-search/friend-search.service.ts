import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UserProfile, FriendshipStatus } from './types';

export { UserProfile, FriendshipStatus };

@Injectable()
export class FriendSearchService {
  constructor(private prisma: PrismaService) {}

  // 相互フォロー（友達）一覧を取得
  async getMutualFriends(username: string): Promise<UserProfile[]> {
    // ユーザーがフォローしている人のリスト
    const following = await this.prisma.friendship.findMany({
      where: { follower: username },
      select: { following: true }
    });

    // ユーザーをフォローしている人のリスト
    const followers = await this.prisma.friendship.findMany({
      where: { following: username },
      select: { follower: true }
    });

    // 相互フォローを見つける（両方向にフォローしている）
    const followingUsernames = following.map(f => f.following);
    const followerUsernames = followers.map(f => f.follower);
    
    const mutualFriends = followingUsernames.filter(username => 
      followerUsernames.includes(username)
    );

    // user_searchサービスからプロフィール情報を取得する必要があるが、
    // 今回はモックデータを返す
    return mutualFriends.map(username => ({
      username,
      profileImage: `/images/avatar/${username}.png`,
      isOnline: Math.random() > 0.5, // ランダムなオンライン状態
    }));
  }

  // フォロー中のユーザー一覧を取得
  async getFollowing(username: string): Promise<UserProfile[]> {
    const following = await this.prisma.friendship.findMany({
      where: { follower: username },
      select: { following: true }
    });

    return following.map(f => ({
      username: f.following,
      profileImage: `/images/avatar/${f.following}.png`,
      isOnline: Math.random() > 0.5,
    }));
  }

  // フォロワー一覧を取得
  async getFollowers(username: string): Promise<UserProfile[]> {
    const followers = await this.prisma.friendship.findMany({
      where: { following: username },
      select: { follower: true }
    });

    return followers.map(f => ({
      username: f.follower,
      profileImage: `/images/avatar/${f.follower}.png`,
      isOnline: Math.random() > 0.5,
    }));
  }

  // フォローを実行
  async followUser(follower: string, following: string): Promise<void> {
    try {
      await this.prisma.friendship.create({
        data: {
          follower,
          following,
        },
      });
    } catch (error) {
      // 既にフォローしている場合は無視
      if (error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  // アンフォローを実行
  async unfollowUser(follower: string, following: string): Promise<void> {
    await this.prisma.friendship.deleteMany({
      where: {
        follower,
        following,
      },
    });
  }

  // フォロー状態を確認
  async getFollowStatus(currentUser: string, targetUser: string): Promise<FriendshipStatus> {
    const [isFollowing, isFollowedBy] = await Promise.all([
      this.prisma.friendship.findFirst({
        where: {
          follower: currentUser,
          following: targetUser,
        },
      }),
      this.prisma.friendship.findFirst({
        where: {
          follower: targetUser,
          following: currentUser,
        },
      }),
    ]);

    return {
      isFollowing: !!isFollowing,
      isFollowedBy: !!isFollowedBy,
      isMutual: !!isFollowing && !!isFollowedBy,
    };
  }
}
