import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { FullAuthGuard } from './full-auth.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        // user_searchサービスはトークンを発行しないので、signOptionsは不要
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy, FullAuthGuard],
  exports: [JwtModule, JwtStrategy, FullAuthGuard],
})
export class AuthModule {}
