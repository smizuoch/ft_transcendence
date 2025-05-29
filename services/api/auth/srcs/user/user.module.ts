import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService],
  exports: [UserService],
})
export class UserModule {}



// このuser.module.tsファイルはNestJSのモジュールシステムの一部で、以下の重要な役割を担っています：

// 依存関係の管理: UserControllerとUserServiceをモジュールとして束ね、PrismaServiceを提供します

// コンポーネントの登録:

// controllers: HTTPリクエストを処理するUserControllerを登録
// providers: ビジネスロジックを扱うUserServiceとデータベース接続を担うPrismaServiceを登録
// exports: UserServiceを他のモジュールで使えるようにエクスポート
// アプリケーションの構造化: 関連する機能をまとめてモジュール化し、アプリケーションを整理します

// このファイルがないと、NestJSアプリケーションのDI（依存性注入）システムが機能せず、UserControllerとUserServiceが適切に接続されません。