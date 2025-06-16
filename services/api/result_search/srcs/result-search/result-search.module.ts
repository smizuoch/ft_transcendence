import { Module } from '@nestjs/common';
import { ResultSearchController } from './result-search.controller';
import { ResultSearchService } from './result-search.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ResultSearchController],
  providers: [ResultSearchService, PrismaService],
  exports: [ResultSearchService],
})
export class ResultSearchModule {}
