import { Controller, Post, Body, Get, UseGuards, Request, ValidationPipe, HttpException, HttpStatus, Req, Res, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { FullAuthGuard } from './full-auth.guard';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/create-user.dto';
import { GoogleOAuthService } from './google-oauth.service';
import { FastifyReply } from 'fastify';

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

  @UseGuards(FullAuthGuard)
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
  async googleAuth(@Res({ passthrough: false }) res: FastifyReply) {
    const authUrl = this.googleOAuthService.getAuthUrl();
    return res.redirect(authUrl, 302);
  }

  @Get('google/callback')
  async googleAuthRedirect(@Query('code') code: string, @Res({ passthrough: false }) res: FastifyReply) {
    try {
      if (!code) {
        throw new HttpException('Authorization code not provided', HttpStatus.BAD_REQUEST);
      }

      // 認証コードをアクセストークンに交換
      const tokens = await this.googleOAuthService.exchangeCodeForTokens(code);
      
      // ユーザー情報を取得
      const userInfo = await this.googleOAuthService.getUserInfo(tokens.access_token);
      
      // ユーザー名の生成とバリデーション
      const proposedUsername = `${userInfo.given_name}_${userInfo.family_name}`;
      
      // 英数字以外の文字をチェック（日本語、特殊文字など）
      const alphanumericRegex = /^[a-zA-Z0-9_]+$/;
      // 日本語文字の存在をチェック
      const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]/;
      
      if (!alphanumericRegex.test(proposedUsername) || japaneseRegex.test(proposedUsername)) {
        console.error('Google authentication failed: Username contains non-alphanumeric or Japanese characters:', proposedUsername);
        return res.redirect(`https://${process.env.HOST_IP}:8443/?error=invalid_username&message=Username must contain only alphanumeric characters`, 302);
      }
      
      // ユーザー名の長さをチェック（16文字まで）
      if (proposedUsername.length > 16) {
        console.error('Google authentication failed: Username too long:', proposedUsername);
        return res.redirect(`https://${process.env.HOST_IP}:8443/?error=username_too_long&message=Username must be 16 characters or less`, 302);
      }
      
      // 既存ユーザーをメールアドレスでチェック（優先）
      let existingUser = await this.userService.findByEmail(userInfo.email);
      console.log('Google auth - checking existing user by email:', userInfo.email, 'found:', !!existingUser);
      
      // メールアドレスで見つからない場合、ユーザー名でもチェック
      if (!existingUser) {
        existingUser = await this.userService.findByUsername(proposedUsername);
        console.log('Google auth - checking existing user by username:', proposedUsername, 'found:', !!existingUser);
        
        // 既存ユーザーが見つかった場合（メールが異なるが同じユーザー名）
        if (existingUser) {
          console.error('Google authentication failed: Username already exists for different email:', proposedUsername);
          return res.redirect(`https://${process.env.HOST_IP}:8443/?error=username_taken&message=This username is already taken`, 302);
        }
      }
      
      // ユーザーをログインまたは作成
      const user = {
        email: userInfo.email,
        username: proposedUsername,
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
      };

      const result = await this.authService.googleLogin({ user });
      
      // フロントエンドにリダイレクトしてトークンを渡す
      const redirectUrl = `https://${process.env.HOST_IP}:8443/auth/callback?token=${result.access_token}`;
      return res.redirect(redirectUrl, 302);
    } catch (error) {
      console.error('Google authentication error:', error);
      return res.redirect(`https://${process.env.HOST_IP}:8443/?error=auth_failed`, 302);
    }
  }
}
