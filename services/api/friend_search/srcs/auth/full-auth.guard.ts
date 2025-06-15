import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';

/**
 * FullAuthGuard - 2FA完了済みのJWTのみアクセス許可
 * twoFactorPending: true のトークンはブロックする
 */
@Injectable()
export class FullAuthGuard {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('JWT token is missing');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      });
      
      // 🔑 2FA完了チェック - twoFactorPendingフラグがtrueの場合のみアクセス拒否
      // Google認証の場合、twoFactorPendingフィールドが存在しないかfalseなのでアクセス許可
      if (payload.twoFactorPending === true) {
        throw new UnauthorizedException('2FA authentication required. Please complete two-factor authentication.');
      }
      
      // リクエストオブジェクトにユーザー情報を追加
      request['user'] = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid JWT token');
    }
  }

  private extractTokenFromHeader(request: FastifyRequest): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;
    
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
