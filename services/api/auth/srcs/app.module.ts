import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UserModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}



// app.module.tsはNestJSアプリケーションのルートモジュールであり、以下の重要な役割を担っています：

// アプリケーションの構成のルート：すべてのモジュールの親として機能し、アプリケーション全体の構造を定義します

// 他のモジュールのインポート：

// ConfigModule.forRoot(): 環境変数の読み込みを行い、アプリケーション全体で使用可能にします（isGlobal: true）
// UserModule: ユーザー管理機能を提供するモジュールをアプリケーションに統合します
// AuthModule: 認証機能を提供するモジュールをアプリケーションに統合します
// NestJSアプリケーションのエントリポイント：main.tsでAppModuleがブートストラップされ、アプリケーションが起動します

// このファイルはアプリケーションの構造の中心であり、このファイルがないとNestJSアプリケーションは起動できません。新しい機能を追加する場合は、関連するモジュールをこのapp.module.tsにインポートする必要があります。