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
  
  // 異なるオリジンとの通信をするためのCORSを有効化
  app.enableCors();
  
  await app.listen(3000, '0.0.0.0'); // 全てのインターフェースでリッスン
  console.log(`Auth service is running on ${await app.getUrl()}`);
}
bootstrap();
