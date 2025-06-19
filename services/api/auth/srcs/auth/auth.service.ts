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

    // 2FA用の仮トークンを発行（2fa_pendingフラグ付き）
    const payload = { 
      sub: user.username, 
      username: user.username,
      email: user.email,
      twoFactorPending: true  // 2FA待機中フラグ
    };
    
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }), // 短い有効期限
      twoFactorRequired: true,
      user: {
        username: user.username,
        email: user.email,
      },
    };
  }

  // 2FA完了後に本番JWTを発行
  async generateFinalJWT(user: any) {
    const payload = { 
      sub: user.username, 
      username: user.username,
      email: user.email
      // twoFactorPendingフラグは付けない（本番JWT）
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        username: user.username,
        email: user.email,
      },
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
    console.log('GoogleLogin service - email:', email, 'username:', username);

    // 既存ユーザーをメールアドレスで検索（最優先）
    let user = await this.userService.findByEmail(email);
    console.log('GoogleLogin service - user found by email:', !!user);
    
    // メールアドレスで見つからない場合のみ、ユーザー名で検索
    if (!user) {
      user = await this.userService.findByUsername(username);
      console.log('GoogleLogin service - user found by username:', !!user);
      
      // 既存ユーザーが見つかったが、メールアドレスが異なる場合はエラー
      if (user && user.email !== email) {
        console.error('GoogleLogin service - username exists with different email');
        throw new UnauthorizedException('Username already exists with different email');
      }
    }

    // ユーザーが存在しない場合は新規作成
    if (!user) {
      console.log('GoogleLogin service - creating new user');
      // Google認証専用メソッドを使用してユーザーを作成
      user = await this.userService.createGoogleUser(email, username);
    } else {
      console.log('GoogleLogin service - existing user found, proceeding with login');
    }

    // Google認証の場合は直接本番JWTを発行（2FA不要）
    const payload = { 
      sub: user.username, 
      username: user.username,
      email: user.email
      // twoFactorPendingフラグは付けない（本番JWT）
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      twoFactorRequired: false,
      user: {
        username: user.username,
        email: user.email,
      },
    };
  }
}
