import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleOAuthService } from './google-oauth.service';
import { UserModule } from '../user/user.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: '24h',
        },
      }),
    }),
  ],
  controllers: [AuthController, TwoFactorController],
  providers: [AuthService, TwoFactorService, GoogleOAuthService, JwtStrategy, JwtAuthGuard, PrismaService],
  exports: [AuthService, TwoFactorService, JwtAuthGuard],
})
export class AuthModule {}
