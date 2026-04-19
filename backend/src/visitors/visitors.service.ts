import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { visitors } from '../database/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { GeoIPService } from '../modules/geoip/geoip.service';

@Injectable()
export class VisitorsService {
  private readonly logger = new Logger(VisitorsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly geoIpService: GeoIPService,
  ) {}

  async track(ip: string, userAgent: string | null, sessionId: string) {
    // Skip tracking for excluded IPs (admin/owner)
    const excludedIps = (process.env.ANALYTICS_EXCLUDE_IPS || '')
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => ip);
    if (excludedIps.includes(ip) || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('127.')) {
      return;
    }

    const now = new Date();
    const existing = await this.db
      .select()
      .from(visitors)
      .where(eq(visitors.sessionId, sessionId))
      .limit(1);

    if (existing.length > 0) {
      const visitor = existing[0];
      const isBot = this.detectBot(userAgent, visitor.pageViews + 1);
      
      await this.db
        .update(visitors)
        .set({
          lastSeen: now,
          pageViews: visitor.pageViews + 1,
          isBot: visitor.isBot || isBot,
        })
        .where(eq(visitors.sessionId, sessionId));

      // Trigger enrichment ONLY if missing
      if (!visitor.country) {
        this.enrichVisitor(sessionId, ip).catch(() => {});
      }
    } else {
      const isBot = this.detectBot(userAgent, 1);
      await this.db.insert(visitors).values({
        id: randomUUID(),
        sessionId,
        ip,
        userAgent,
        firstSeen: now,
        lastSeen: now,
        pageViews: 1,
        isBot,
      });

      // Enrich new visitor
      this.enrichVisitor(sessionId, ip).catch(() => {});
    }
  }

  private detectBot(userAgent: string | null, pageViews: number): boolean {
    if (pageViews > 100) return true;
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return ['curl', 'bot', 'crawler', 'spider'].some(k => ua.includes(k));
  }

  private async enrichVisitor(sessionId: string, ip: string) {
    try {
      const geo = this.geoIpService.lookup(ip);
      if (!geo) return;

      await this.db
        .update(visitors)
        .set({
          country: geo.country,
          city: geo.city,
          latitude: geo.latitude,
          longitude: geo.longitude,
          timezone: geo.timezone,
        })
        .where(and(
          eq(visitors.sessionId, sessionId),
          sql`${visitors.country} IS NULL`
        ));
    } catch (err) {
      // Fail silently as per requirements
    }
  }

  async getVisitors(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const countResult = await this.db.execute(sql<any[]>`SELECT COUNT(*) as count FROM visitors`);
    const total = Number(countResult[0]?.count) || 0;
    
    // Use select() with raw SQL
    const results = await this.db.select()
      .from(visitors)
      .limit(limit)
      .offset(offset);
    
    const data = results.map((v: any) => ({
      id: v.id,
      ip: v.ip,
      session_id: v.sessionId,
      user_agent: v.userAgent,
      is_bot: v.isBot,
      page_views: v.pageViews,
      first_seen: v.firstSeen,
      last_seen: v.lastSeen,
      country: v.country,
      city: v.city,
    }));
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStats() {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalResult, todayResult, realtimeResult] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(visitors),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(visitors)
        .where(gte(visitors.firstSeen, todayStart)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(visitors)
        .where(
          and(
            gte(visitors.lastSeen, yesterday),
            gte(visitors.lastSeen, todayStart),
          ),
        ),
    ]);

    return {
      total: totalResult[0]?.count || 0,
      today: todayResult[0]?.count || 0,
      realtime: realtimeResult[0]?.count || 0,
    };
  }
}
