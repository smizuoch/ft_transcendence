import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        // result_searchサービスはトークンを発行しないので、signOptionsは不要
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy, AuthGuard],
  exports: [JwtModule, JwtStrategy, AuthGuard],
})
export class AuthModule {}