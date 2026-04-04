import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, asc, sql, and, gte, SQL } from 'drizzle-orm';
import { signals, Signal, NewSignal } from '../database/schema';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';

@Injectable()
export class SignalsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  /**
   * Check if a hash already exists in the database
   */
  async hashExists(hash: string): Promise<boolean> {
    const result = await this.db
      .select({ hash: signals.hash })
      .from(signals)
      .where(eq(signals.hash, hash))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Insert a new signal. Returns false if hash duplicate.
   */
  async insert(data: NewSignal): Promise<boolean> {
    try {
      await this.db.insert(signals).values(data);
      return true;
    } catch (error: any) {
      // Handle unique constraint violation on hash
      if (error?.code === '23505') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Find signals with pagination and optional filtering
   */
  async findAll(params: {
    page: number;
    limit: number;
    severity?: string;
    source?: string;
    categoryId?: string;
    since?: Date;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ data: Signal[]; total: number }> {
    const { page, limit, severity, source, categoryId, since, sort = 'created_at', order = 'desc' } = params;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: SQL[] = [];

    if (severity) {
      conditions.push(eq(signals.severity, severity));
    }
    if (source) {
      conditions.push(eq(signals.source, source));
    }
    if (categoryId) {
      conditions.push(eq(signals.categoryId, categoryId));
    }
    if (since) {
      conditions.push(gte(signals.createdAt, since));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column
    const sortColumn =
      sort === 'score' ? signals.score :
      sort === 'severity' ? signals.severity :
      sort === 'published_at' ? signals.publishedAt :
      signals.createdAt;

    const orderFn = order === 'asc' ? asc : desc;

    // Execute queries
    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(signals)
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(signals)
        .where(whereClause),
    ]);

    return {
      data,
      total: countResult[0]?.count || 0,
    };
  }

  /**
   * Get stats for the dashboard
   */
  async getStats(): Promise<{
    total: number;
    high: number;
    medium: number;
    low: number;
    last24h: number;
    topSource: string;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalResult,
      highResult,
      mediumResult,
      lowResult,
      last24hResult,
      topSourceResult,
    ] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(eq(signals.severity, 'high')),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(eq(signals.severity, 'medium')),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(eq(signals.severity, 'low')),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(gte(signals.createdAt, oneDayAgo)),
      this.db
        .select({
          source: signals.source,
          count: sql<number>`count(*)::int`,
        })
        .from(signals)
        .groupBy(signals.source)
        .orderBy(desc(sql`count(*)`))
        .limit(1),
    ]);

    return {
      total: totalResult[0]?.count || 0,
      high: highResult[0]?.count || 0,
      medium: mediumResult[0]?.count || 0,
      low: lowResult[0]?.count || 0,
      last24h: last24hResult[0]?.count || 0,
      topSource: topSourceResult[0]?.source || 'N/A',
    };
  }
}
