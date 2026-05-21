import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ConsoleLogger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

// Write logs to file so admin panel can read them
const logDir = join(process.cwd(), 'logs');
mkdirSync(logDir, { recursive: true });
const logStream = createWriteStream(join(logDir, 'app.log'), { flags: 'a' });

class FileLogger extends ConsoleLogger {
  private write(level: string, message: string, context?: string) {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      context: context || this.context,
      message,
    });
    logStream.write(line + '\n');
  }
  log(message: string, context?: string)   { super.log(message, context);   this.write('info',  message, context); }
  warn(message: string, context?: string)  { super.warn(message, context);  this.write('warn',  message, context); }
  error(message: string, context?: string) { super.error(message, context); this.write('error', message, context); }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  if (!process.env.DATABASE_URL) {
    logger.error('Missing required environment variable: DATABASE_URL');
    process.exit(1);
  }

  // Pulse encryption key validation
  const pulseKey = process.env.PULSE_ENCRYPTION_KEY;
  const isProd = process.env.NODE_ENV === 'production';
  if (!pulseKey) {
    if (isProd) {
      logger.error(
        'PULSE_ENCRYPTION_KEY is not set. This is required in production to protect stored publishing credentials. ' +
        'Generate one with: openssl rand -hex 32',
      );
      process.exit(1);
    } else {
      logger.warn(
        'PULSE_ENCRYPTION_KEY not set — using insecure development fallback. ' +
        'Never run without this key in production.',
      );
    }
  } else if (pulseKey.length < 32) {
    const msg = `PULSE_ENCRYPTION_KEY is too short (${pulseKey.length} chars, minimum 32).`;
    if (isProd) {
      logger.error(msg);
      process.exit(1);
    } else {
      logger.warn(msg + ' Proceeding in development mode.');
    }
  }

  if (!process.env.DISCORD_WEBHOOK_URL) {
    logger.warn('DISCORD_WEBHOOK_URL not set — alerts will be skipped');
  }

  const app = await NestFactory.create(AppModule, { logger: new FileLogger() });

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
