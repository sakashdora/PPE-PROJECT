import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable Native WebSocket adapter (@nestjs/platform-ws)
  app.useWebSocketAdapter(new WsAdapter(app));

  // 2. Cookie parser for httpOnly JWT session tokens
  app.use(cookieParser());

  // 3. Strict CORS (allows dashboard origin with credentials)
  app.enableShutdownHooks();
  const allowedOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = allowedOrigin.split(',');
      if (
        allowed.includes(origin) ||
        origin === 'http://127.0.0.1:3000' ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):3000$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Edge-Api-Key', 'If-None-Match'],
    exposedHeaders: ['ETag'],
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log('=============================================================');
  console.log(` [OK] Factory Safety AI - On-Prem Server Online!`);
  console.log(`      REST API:      http://localhost:${port}`);
  console.log(`      WebSocket:     ws://localhost:${port}/ws`);
  console.log(`      Live Health:   http://localhost:${port}/health/live`);
  console.log('=============================================================');
}

bootstrap();
