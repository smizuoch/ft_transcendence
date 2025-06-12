import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  VerifyTwoFactorCodeDto,
  TwoFactorResponseDto,
} from './dto/two-factor.dto';

@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

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
    return {
      success: result.success,
      message: result.message,
      data: result.user,
    };
  }
}
