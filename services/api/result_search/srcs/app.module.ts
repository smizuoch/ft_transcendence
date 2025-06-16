import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { ResultSearchModule } from './result-search/result-search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    ResultSearchModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}