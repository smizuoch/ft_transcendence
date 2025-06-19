import { Module } from '@nestjs/common';
import { UserSearchController } from './user-search.controller';
import { UserSearchService } from './user-search.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserSearchController],
  providers: [UserSearchService, PrismaService],
  exports: [UserSearchService],
})
export class UserSearchModule {}
