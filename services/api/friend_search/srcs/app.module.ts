import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FriendSearchModule } from './friend-search/friend-search.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FriendSearchModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
