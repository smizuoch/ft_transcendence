import { Module } from '@nestjs/common';
import { FriendSearchController } from './friend-search.controller';
import { FriendSearchService } from './friend-search.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FriendSearchController],
  providers: [FriendSearchService, PrismaService],
})
export class FriendSearchModule {}
