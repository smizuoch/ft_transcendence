import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}




// prisma.service.tsは以下の重要な役割を担います：

// データベース接続の管理: PrismaClientを拡張してNestJSに統合し、アプリケーションのデータベース接続を管理します

// シングルトンインスタンス: アプリケーション全体で単一のデータベース接続を提供するインジェクタブルサービスとして機能します

// 自動接続機能: OnModuleInitインターフェースを実装し、モジュールの初期化時にデータベースに自動接続します

// DIシステムとの連携: @Injectable()デコレータにより、NestJSの依存性注入システムに登録され、他のサービス（例：UserService）で使用できるようになります

// このファイルはPrismaクライアントとNestJSアプリケーションを繋ぐ架け橋として機能し、データベースアクセスを必要とする全てのサービスで使用される基盤的なコンポーネントです。