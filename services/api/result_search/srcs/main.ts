import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: [`https://${process.env.HOST_IP}:8443`, `http://${process.env.HOST_IP}:8080`],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  // Set global prefix
  app.setGlobalPrefix('api');

  await app.listen(3000, '0.0.0.0'); // compose.ymlで3004:3000にマッピングされているので3000を使用
  console.log(`Result Search service is running on http://${process.env.HOST_IP}:3000 (mapped to external port 3004)`);
}

bootstrap();