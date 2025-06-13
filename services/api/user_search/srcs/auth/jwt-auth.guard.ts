import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';

@Injectable()
export class JwtAuthGuard {
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
      
      // リクエストオブジェクトにユーザー情報を追加
      request['user'] = payload;
      return true;
    } catch (error) {
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
