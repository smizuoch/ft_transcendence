import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  VerifyTwoFactorCodeDto,
  TwoFactorResponseDto,
} from './two-factor.dto';

@Controller('auth/2fa')
export class TwoFactorController {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly authService: AuthService,
  ) {}

  @Post('send')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendTwoFactorCode(@Req() req: any): Promise<TwoFactorResponseDto> {
    // JWTペイロードからemailを取得
    const email = req.user.email;
    
    if (!email) {
      return {
        success: false,
        message: 'JWTトークンにメールアドレスが含まれていません',
      };
    }

    const result = await this.twoFactorService.sendTwoFactorCode(email);
    return {
      success: result.success,
      message: result.message,
    };
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactorCode(@Body() verifyCodeDto: VerifyTwoFactorCodeDto, @Req() req: any): Promise<TwoFactorResponseDto> {
    // JWTペイロードからemailを取得
    const email = req.user.email;
    
    if (!email) {
      return {
        success: false,
        message: 'JWTトークンにメールアドレスが含まれていません',
      };
    }

    const result = await this.twoFactorService.verifyTwoFactorCode(
      email,
      verifyCodeDto.code,
    );

    if (result.success && result.user) {
      // 2FA検証成功時に本番JWTを発行
      const finalJwt = await this.authService.generateFinalJWT(result.user);
      
      return {
        success: true,
        message: result.message,
        data: {
          access_token: finalJwt.access_token,
          user: finalJwt.user,
        },
      };
    }

    return {
      success: result.success,
      message: result.message,
    };
  }
}
