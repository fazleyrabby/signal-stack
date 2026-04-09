import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, asc, sql, and, gte, SQL, or, ilike } from 'drizzle-orm';
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
   * Insert a new signal. Returns the inserted signal or null if duplicate.
   */
  async insert(data: NewSignal): Promise<Signal | null> {
    try {
      const [inserted] = await this.db.insert(signals).values(data).returning();
      return inserted;
    } catch (error: any) {
      // Handle unique constraint violation on hash
      if (error?.code === '23505') {
        return null;
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
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<{ data: Signal[]; total: number }> {
    const { page, limit, severity, source, categoryId, since, search, sort = 'created_at', order = 'desc' } = params;
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
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(
        ilike(signals.title, term),
        ilike(signals.summary, term),
        ilike(signals.content, term)
      ) as SQL);
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
    geopolitics: number;
    technology: number;
    aiProcessed: number;
    aiFailed: number;
    highPending: number;
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
      geopoliticsResult,
      technologyResult,
      aiProcessedResult,
      aiFailedResult,
      highPendingResult,
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
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(eq(signals.categoryId, 'geopolitics')),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(eq(signals.categoryId, 'technology')),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(eq(signals.aiProcessed, true)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(eq(signals.aiFailed, true)),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(and(eq(signals.severity, 'high'), eq(signals.aiProcessed, false))),
    ]);

    return {
      total: totalResult[0]?.count || 0,
      high: highResult[0]?.count || 0,
      medium: mediumResult[0]?.count || 0,
      low: lowResult[0]?.count || 0,
      last24h: last24hResult[0]?.count || 0,
      topSource: topSourceResult[0]?.source || 'N/A',
      geopolitics: geopoliticsResult[0]?.count || 0,
      technology: technologyResult[0]?.count || 0,
      aiProcessed: aiProcessedResult[0]?.count || 0,
      aiFailed: aiFailedResult[0]?.count || 0,
      highPending: highPendingResult[0]?.count || 0,
    };
  }

  async getUniqueSources(categoryId?: string): Promise<{ source: string; count: number }[]> {
    const results = await this.db
      .select({
        source: signals.source,
        count: sql<number>`count(*)::int`,
      })
      .from(signals)
      .where(categoryId ? eq(signals.categoryId, categoryId) : undefined)
      .groupBy(signals.source)
      .orderBy(desc(sql`count(*)`));

    return results.map(r => ({ source: r.source, count: r.count }));
  }

  async getAIProviderStats(): Promise<{ provider: string; count: number }[]> {
    const results = await this.db
      .select({
        provider: signals.aiProvider,
        count: sql<number>`count(*)::int`,
      })
      .from(signals)
      .where(eq(signals.aiProcessed, true))
      .groupBy(signals.aiProvider)
      .orderBy(desc(sql`count(*)`));

    return results.map(r => ({ provider: r.provider || 'none', count: r.count }));
  }

  async getTrends() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Volume by day with severity breakdown
    const volumeByDay = await this.db
      .select({
        date: sql<string>`TO_CHAR(signals.createdAt, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        high: sql<number>`SUM(CASE WHEN signals.severity = 'high' THEN 1 ELSE 0 END)::int`,
        medium: sql<number>`SUM(CASE WHEN signals.severity = 'medium' THEN 1 ELSE 0 END)::int`,
        low: sql<number>`SUM(CASE WHEN signals.severity = 'low' THEN 1 ELSE 0 END)::int`,
      })
      .from(signals)
      .where(gte(signals.createdAt, thirtyDaysAgo))
      .groupBy(sql`TO_CHAR(signals.createdAt, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(signals.createdAt, 'YYYY-MM-DD')`);

    // Top sources with average score
    const topSources = await this.db
      .select({
        source: signals.source,
        count: sql<number>`count(*)::int`,
        avgScore: sql<number>`AVG(signals.score)::numeric(10,1)`,
      })
      .from(signals)
      .where(gte(signals.createdAt, thirtyDaysAgo))
      .groupBy(signals.source)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Category breakdown
    const categoryBreakdown = await this.db
      .select({
        category: categories.name,
        count: sql<number>`count(*)::int`,
      })
      .from(signals)
      .innerJoin(categories, eq(signals.categoryId, categories.slug))
      .where(gte(signals.createdAt, thirtyDaysAgo))
      .groupBy(categories.name)
      .orderBy(desc(sql`count(*)`));

    // Severity distribution
    const severityDistributionResult = await this.db
      .select({
        severity: signals.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(signals)
      .where(gte(signals.createdAt, thirtyDaysAgo))
      .groupBy(signals.severity);

    // Convert severity distribution to object format
    const severityDistribution = {
      high: 0,
      medium: 0,
      low: 0,
    };
    severityDistributionResult.forEach(row => {
      if (row.severity === 'high') {
        severityDistribution.high = row.count;
      } else if (row.severity === 'medium') {
        severityDistribution.medium = row.count;
      } else if (row.severity === 'low') {
        severityDistribution.low = row.count;
      }
    });

    // AI stats
    const aiStatsResult = await this.db
      .select({
        processed: sql<number>`SUM(CASE WHEN signals.aiProcessed = true THEN 1 ELSE 0 END)::int`,
        failed: sql<number>`SUM(CASE WHEN signals.aiFailed = true THEN 1 ELSE 0 END)::int`,
        local: sql<number>`SUM(CASE WHEN signals.aiProvider = 'local' AND signals.aiProcessed = true THEN 1 ELSE 0 END)::int`,
        groq: sql<number>`SUM(CASE WHEN signals.aiProvider = 'groq' AND signals.aiProcessed = true THEN 1 ELSE 0 END)::int`,
        openrouter: sql<number>`SUM(CASE WHEN signals.aiProvider = 'openrouter' AND signals.aiProcessed = true THEN 1 ELSE 0 END)::int`,
      })
      .from(signals)
      .where(gte(signals.createdAt, thirtyDaysAgo));

    const aiStats = {
      processed: aiStatsResult[0]?.processed || 0,
      failed: aiStatsResult[0]?.failed || 0,
      byProvider: {
        local: aiStatsResult[0]?.local || 0,
        groq: aiStatsResult[0]?.groq || 0,
        openrouter: aiStatsResult[0]?.openrouter || 0,
      },
    };

    return {
      volumeByDay: volumeByDay.map(day => ({
        date: day.date,
        count: day.count,
        high: day.high,
        medium: day.medium,
        low: day.low,
      })),
      topSources: topSources.map(source => ({
        source: source.source,
        count: source.count,
        avgScore: Number(source.avgScore),
      })),
      categoryBreakdown: categoryBreakdown.map(cat => ({
        category: cat.category,
        count: cat.count,
      })),
      severityDistribution,
      aiStats,
    };
  }
}
