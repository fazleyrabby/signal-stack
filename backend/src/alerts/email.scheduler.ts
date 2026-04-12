import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from './email.service';
import { logEvent } from '../common/logger';

@Injectable()
export class EmailScheduler implements OnModuleInit {
  constructor(private readonly emailService: EmailService) {}

  async onModuleInit() {
    // Startup email trigger removed to prevent spam during deployments.
    // Daily digest will strictly follow the cron schedule at 8:00 AM.
  }

  /**
   * Run daily at 8:00 AM. Sends email digest of top signals.
   */
  @Cron('0 8 * * *')
  async sendScheduledDigest() {
    if (process.env.DISABLE_SCHEDULER === 'true') {
      return;
    }
    logEvent('info', 'email_digest_start', {});

    try {
      await this.emailService.sendDigest();
      logEvent('info', 'email_digest_complete', {});
    } catch (error) {
      logEvent('error', 'email_digest_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
