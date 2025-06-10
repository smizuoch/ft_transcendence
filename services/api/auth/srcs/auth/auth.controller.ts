import { Controller, Post, Body, Get, UseGuards, Request, ValidationPipe, HttpException, HttpStatus, Req, Res, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/create-user.dto';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  @Post('login')
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @Post('verify')
  async verifyToken(@Body() verifyTokenDto: { token: string }) {
    return this.authService.verifyToken(verifyTokenDto.token);
  }

  @Post('register')
  async register(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    try {
      // メールアドレスの重複チェック
      const existingUser = await this.userService.findByEmail(createUserDto.email);
      if (existingUser) {
        throw new HttpException('This email address is already in use', HttpStatus.BAD_REQUEST);
      }

      // ユーザー名の重複チェック
      const existingUsername = await this.userService.findByUsername(createUserDto.username);
      if (existingUsername) {
        throw new HttpException('This username is already taken', HttpStatus.BAD_REQUEST);
      }

      // ユーザー作成
      const user = await this.userService.create(createUserDto);
      
      return {
        message: 'User registration completed successfully',
        user,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('An error occurred during registration', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('google')
  async googleAuth(@Res() res) {
    const authUrl = this.googleOAuthService.getAuthUrl();
    return res.redirect(authUrl);
  }

  @Get('google/callback')
  async googleAuthRedirect(@Query('code') code: string, @Res() res) {
    try {
      if (!code) {
        throw new HttpException('Authorization code not provided', HttpStatus.BAD_REQUEST);
      }

      // 認証コードをアクセストークンに交換
      const tokens = await this.googleOAuthService.exchangeCodeForTokens(code);
      
      // ユーザー情報を取得
      const userInfo = await this.googleOAuthService.getUserInfo(tokens.access_token);
      
      // ユーザーをログインまたは作成
      const user = {
        email: userInfo.email,
        username: `${userInfo.given_name}_${userInfo.family_name}`,
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
      };

      const result = await this.authService.googleLogin({ user });
      
      // フロントエンドにリダイレクトしてトークンを渡す
      const redirectUrl = `https://localhost:8443/auth/callback?token=${result.access_token}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google authentication error:', error);
      return res.redirect('https://localhost:8443/?error=auth_failed');
    }
  }
}
