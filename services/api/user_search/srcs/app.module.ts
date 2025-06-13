import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserSearchModule } from './user-search/user-search.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UserSearchModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
