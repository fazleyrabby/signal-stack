import { Logger } from '@nestjs/common';

const logger = new Logger('SignalStack');

export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  data?: Record<string, unknown>,
) {
  const payload = { event, ...data, timestamp: new Date().toISOString() };

  switch (level) {
    case 'info':
      logger.log(JSON.stringify(payload));
      break;
    case 'warn':
      logger.warn(JSON.stringify(payload));
      break;
    case 'error':
      logger.error(JSON.stringify(payload));
      break;
  }
}
