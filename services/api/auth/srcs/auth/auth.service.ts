import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './login.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    
    // Google認証ユーザー（passwordがnull）の場合は通常ログインを拒否
    if (user && user.password && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    
    return null;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.validateUser(email, password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { 
      sub: user.username, 
      username: user.username,
      email: user.email  // JWTペイロードにemailを追加
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async verifyToken(token: string) {
    try {
      const payload = await this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async googleLogin(req: any) {
    if (!req.user) {
      throw new UnauthorizedException('No user from Google');
    }

    const { email, username } = req.user;

    // 既存ユーザーをチェック
    let user = await this.userService.findByEmail(email);
    // 名前もチェック
    if (!user) {
      user = await this.userService.findByUsername(username);
    }

    // ユーザーが存在しない場合は新規作成
    if (!user) {
      // Google認証専用メソッドを使用してユーザーを作成
      const newUser = await this.userService.createGoogleUser(email, username);
      user = {
        username: newUser.username,
        email: newUser.email,
        password: null, // Google認証ユーザーはパスワードがnull
      };
    }

    const payload = { 
      sub: user.username, 
      username: user.username,
      email: user.email  // Google認証でもJWTペイロードにemailを追加
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        username: user.username,
        email: user.email,
      },
    };
  }
}
