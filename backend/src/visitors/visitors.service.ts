import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { visitors } from '../database/schema';
import { eq, sql, and, gte, lt } from 'drizzle-orm';
import { randomUUID } from 'crypto';

@Injectable()
export class VisitorsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  async track(ip: string, userAgent: string | null, sessionId: string) {
    const now = new Date();
    const existing = await this.db
      .select()
      .from(visitors)
      .where(eq(visitors.sessionId, sessionId))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(visitors)
        .set({
          lastSeen: now,
          pageViews: existing[0].pageViews + 1,
        })
        .where(eq(visitors.sessionId, sessionId));
    } else {
      await this.db.insert(visitors).values({
        id: randomUUID(),
        sessionId,
        ip,
        userAgent,
        firstSeen: now,
        lastSeen: now,
        pageViews: 1,
      });
    }
  }

  async getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalResult, todayResult, realtimeResult] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(visitors),
      this.db.select({ count: sql<number>`count(*)::int` }).from(visitors).where(gte(visitors.firstSeen, todayStart)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(visitors)
        .where(and(gte(visitors.lastSeen, yesterday), gte(visitors.lastSeen, todayStart))),
    ]);

    return {
      total: totalResult[0]?.count || 0,
      today: todayResult[0]?.count || 0,
      realtime: realtimeResult[0]?.count || 0,
    };
  }
}