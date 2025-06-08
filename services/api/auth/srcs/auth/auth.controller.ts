import { Controller, Post, Body, Get, UseGuards, Request, ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
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
}
