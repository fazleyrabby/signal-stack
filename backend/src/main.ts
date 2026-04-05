import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate required env vars
  const required = ['DATABASE_URL'];
  for (const key of required) {
    if (!process.env[key]) {
      logger.error(`Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }

  if (!process.env.DISCORD_WEBHOOK_URL) {
    logger.warn('DISCORD_WEBHOOK_URL not set — alerts will be skipped');
  }

  const app = await NestFactory.create(AppModule);

  // Parse cookies for JWT session management
  app.use(cookieParser());

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 SignalStack API ready on http://0.0.0.0:${port}`);
  logger.log(`🔗 Cross-Origin Allowed: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
}
bootstrap();
