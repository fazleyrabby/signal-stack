import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { lt } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { visitors } from '../database/schema';
import { logEvent } from '../common/logger';

const VISITOR_RETENTION_DAYS = parseInt(process.env.VISITOR_RETENTION_DAYS || '90', 10);

@Injectable()
export class VisitorsScheduler {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  // Run at 3 AM daily — offset from signals cleanup (2 AM) to avoid DB contention
  @Cron('0 3 * * *')
  async cleanupOldVisitors() {
    const cutoff = new Date(Date.now() - VISITOR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    try {
      const deleted = await this.db
        .delete(visitors)
        .where(lt(visitors.lastSeen, cutoff))
        .returning({ id: visitors.id });

      logEvent('info', 'visitors_cleanup_complete', {
        retentionDays: VISITOR_RETENTION_DAYS,
        cutoff: cutoff.toISOString(),
        deleted: deleted.length,
      });
    } catch (error) {
      logEvent('error', 'visitors_cleanup_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
