import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { promises as fs } from 'fs';
import { join } from 'path';

const logFile = join(process.cwd(), 'logs/app.log');

async function ensureLogDir() {
  const logDir = join(process.cwd(), 'logs');
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch {}
}

async function logToFile(message: string) {
  try {
    await ensureLogDir();
    const timestamp = new Date().toISOString();
    await fs.appendFile(logFile, `[${timestamp}] ${message}\n`);
  } catch {}
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

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

  const app = await NestFactory.create(AppModule, {
    logger: {
      log: (msg) => { logger.log(msg); logToFile(msg); },
      error: (msg) => { logger.error(msg); logToFile(`ERROR: ${msg}`); },
      warn: (msg) => { logger.warn(msg); logToFile(`WARN: ${msg}`); },
      debug: (msg) => { logger.debug(msg); },
    },
  });

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