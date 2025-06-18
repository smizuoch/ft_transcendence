import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Fastifyアダプターを使用してNestアプリケーションを作成
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 10 * 1024 * 1024, // 10MB リクエストボディサイズ制限
    })
  );
  
  // バリデーションパイプを追加
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // DTOに定義されていないプロパティは除外
    transform: true, // DTOに変換
    forbidNonWhitelisted: true, // 許可されていないプロパティがあるとエラーを発生
  }));
  
  // 異なるオリジンとの通信をするためのCORSを有効化
  app.enableCors({
    origin: [`https://${process.env.HOST_IP}:8443`, `http://${process.env.HOST_IP}:8080`],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });
  
  await app.listen(3000, '0.0.0.0'); // compose.ymlで3004:3000にマッピングされる予定なので3000を使用
  console.log('Friend Search service is running on http://127.0.0.1:3000 (mapped to external port 3004)');
}
bootstrap();