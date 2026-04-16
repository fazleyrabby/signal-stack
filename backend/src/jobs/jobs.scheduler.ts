import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsService } from './jobs.service';

@Injectable()
export class JobsScheduler {
  private readonly logger = new Logger(JobsScheduler.name);

  constructor(private readonly jobsService: JobsService) {}

  /**
   * Fetch and match jobs every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleJobFetch() {
    this.logger.log('Starting scheduled job fetch...');
    await this.jobsService.processJobs();
  }

  /**
   * Daily cleanup at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCleanup() {
    this.logger.log('Starting daily job cleanup...');
    await this.jobsService.cleanupStaleJobs();
  }
}
