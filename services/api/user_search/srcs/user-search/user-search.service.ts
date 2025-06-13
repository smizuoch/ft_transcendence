import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserSearchService {
  constructor(private prisma: PrismaService) {}

  async findUserProfile(username: string) {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { username },
      select: {
        username: true,
        profileImage: true,
        isOnline: true,
      },
    });

    if (!userProfile) {
      throw new NotFoundException(`User profile not found for username: ${username}`);
    }

    return userProfile;
  }

  async updateOnlineStatus(username: string, isOnline: boolean) {
    const userProfile = await this.prisma.userProfile.upsert({
      where: { username },
      update: { isOnline },
      create: {
        username,
        isOnline,
        profileImage: '/images/avatar/default_avatar.png',
      },
      select: {
        username: true,
        profileImage: true,
        isOnline: true,
      },
    });

    return userProfile;
  }

  async updateProfileImage(username: string, profileImage: string) {
    const userProfile = await this.prisma.userProfile.upsert({
      where: { username },
      update: { profileImage },
      create: {
        username,
        profileImage,
        isOnline: true,
      },
      select: {
        username: true,
        profileImage: true,
        isOnline: true,
      },
    });

    return userProfile;
  }

  async createOrUpdateUserProfile(username: string, profileData?: { profileImage?: string }) {
    const userProfile = await this.prisma.userProfile.upsert({
      where: { username },
      update: {
        ...(profileData?.profileImage && { profileImage: profileData.profileImage }),
        isOnline: true,
      },
      create: {
        username,
        profileImage: profileData?.profileImage || '/images/avatar/default_avatar.png',
        isOnline: true,
      },
      select: {
        username: true,
        profileImage: true,
        isOnline: true,
      },
    });

    return userProfile;
  }
}
