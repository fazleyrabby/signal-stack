import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  if (!process.env.DATABASE_URL) {
    logger.error('Missing required environment variable: DATABASE_URL');
    process.exit(1);
  }

  if (!process.env.DISCORD_WEBHOOK_URL) {
    logger.warn('DISCORD_WEBHOOK_URL not set — alerts will be skipped');
  }

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 SignalStack API ready on http://0.0.0.0:${port}`);
}
bootstrap();
