import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // FastifyAdapterを使用してNestアプリケーションを作成
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );
  
  // バリデーションパイプを追加
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // DTOに定義されていないプロパティは除外
    transform: true, // DTOに変換
    forbidNonWhitelisted: true, // 許可されていないプロパティがあるとエラーを発生
  }));
  
  // CORSを有効化（必要に応じて）
  app.enableCors();
  
  await app.listen(3000, '0.0.0.0'); // 全てのインターフェースでリッスン
  console.log(`Auth service is running on ${await app.getUrl()}`);
}
bootstrap();



// create-user.dto.tsの役割
// create-user.dto.tsはデータ転送オブジェクト（DTO: Data Transfer Object）を定義するファイルです。具体的には：

// ユーザー作成時のデータ構造定義：
// ユーザー作成に必要な情報（ユーザー名、メール、パスワード）を定義
// フロントエンドからバックエンドへのデータ送信時の形式を規定

// バリデーション規則の定義：
// class-validatorというライブラリのデコレータを使用
// @IsNotEmpty(): 各フィールドが空ではないことを確認
// @IsString(): ユーザー名とパスワードが文字列であることを確認
// @IsEmail(): メールアドレスの形式が正しいことを確認
// @MinLength(8): パスワードが最低8文字以上であることを確認

// APIとの連携：
// NestJSのコントローラーやサービスでこのDTOを使用して、APIエンドポイントが受け取るデータの検証と型付けを行います
// リクエストボディからのデータ抽出と型安全性の確保に役立ちます
// このファイルはフロントエンドからのユーザー登録リクエストを受け取る際のデータ構造と検証ルールを定義しており、アプリケーションのセキュリティと堅牢性に貢献しています。