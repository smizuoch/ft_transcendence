import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FullAuthGuard } from './full-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        // friend_searchサービスはトークンを発行しないので、signOptionsは不要
      }),
      inject: [ConfigService],
    }),
    ],
  providers: [FullAuthGuard],
  exports: [JwtModule, FullAuthGuard],
})
export class AuthModule {}
