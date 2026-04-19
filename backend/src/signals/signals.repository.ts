import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, asc, sql, and, gte, SQL, or, ilike, isNotNull, notInArray } from 'drizzle-orm';
import { signals, categories, sources, Signal, NewSignal } from '../database/schema';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';

@Injectable()
export class SignalsRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB) {}

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
    countryCode?: string;
    since?: Date;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    minScore?: number;
    hasTranslation?: boolean;
    translationLang?: string;
    excludeJobSources?: boolean;
  }): Promise<{ data: Signal[]; total: number }> {
    const {
      page,
      limit,
      severity,
      source,
      categoryId,
      countryCode,
      since,
      search,
      sort = 'created_at',
      order = 'desc',
      minScore,
      hasTranslation,
      translationLang,
      excludeJobSources = false,
    } = params;
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
    if (countryCode) {
      conditions.push(eq(signals.countryCode, countryCode));
    }
    if (since) {
      conditions.push(gte(signals.createdAt, since));
    }
    if (search) {
      const term = `%${search}%`;
      conditions.push(
        or(
          ilike(signals.title, term),
          ilike(signals.summary, term),
          ilike(signals.content, term),
        ) as SQL,
      );
    }
    if (minScore !== undefined) {
      conditions.push(gte(signals.score, minScore));
    }
    if (hasTranslation === true) {
      conditions.push(sql`translations IS NOT NULL AND translations != '{}'::jsonb`);
    } else if (hasTranslation === false) {
      conditions.push(sql`(translations IS NULL OR translations = '{}'::jsonb)`);
    }
    if (translationLang) {
      conditions.push(sql`translations ? ${translationLang}`);
    }
    if (excludeJobSources) {
      const jobSources = await this.db
        .select({ name: sources.name })
        .from(sources)
        .where(eq(sources.type, 'job'));
      const jobSourceNames = jobSources.map((s) => s.name);
      if (jobSourceNames.length > 0) {
        conditions.push(notInArray(signals.source, jobSourceNames));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column
    const sortColumn =
      sort === 'score'
        ? signals.score
        : sort === 'severity'
          ? signals.severity
          : sort === 'published_at'
            ? signals.publishedAt
            : signals.createdAt;

    const orderFn = order === 'asc' ? asc : desc;

    // Execute queries
    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(signals)
        .where(whereClause)
        .orderBy(orderFn(sortColumn), desc(signals.id))
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
    translated: number;
  }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [countResult, topSourceResult] = await Promise.all([
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          high: sql<number>`count(*) FILTER (WHERE severity = 'high' AND created_at >= ${oneDayAgo})::int`,
          medium: sql<number>`count(*) FILTER (WHERE severity = 'medium')::int`,
          low: sql<number>`count(*) FILTER (WHERE severity = 'low')::int`,
          last24h: sql<number>`count(*) FILTER (WHERE created_at >= ${oneDayAgo})::int`,
          geopolitics: sql<number>`count(*) FILTER (WHERE category_id = 'geopolitics')::int`,
          technology: sql<number>`count(*) FILTER (WHERE category_id = 'technology')::int`,
          aiProcessed: sql<number>`count(*) FILTER (WHERE ai_processed = true)::int`,
          aiFailed: sql<number>`count(*) FILTER (WHERE ai_failed = true)::int`,
          highPending: sql<number>`count(*) FILTER (WHERE severity = 'high' AND ai_processed = false)::int`,
          translated: sql<number>`count(*) FILTER (WHERE translations != '{}'::jsonb)::int`,
        })
        .from(signals),
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

    const row = countResult[0];
    return {
      total: row?.total ?? 0,
      high: row?.high ?? 0,
      medium: row?.medium ?? 0,
      low: row?.low ?? 0,
      last24h: row?.last24h ?? 0,
      topSource: topSourceResult[0]?.source ?? 'N/A',
      geopolitics: row?.geopolitics ?? 0,
      technology: row?.technology ?? 0,
      aiProcessed: row?.aiProcessed ?? 0,
      aiFailed: row?.aiFailed ?? 0,
      highPending: row?.highPending ?? 0,
      translated: row?.translated ?? 0,
    };
  }

  async getUniqueSources(
    categoryId?: string,
  ): Promise<{ source: string; count: number }[]> {
    const results = await this.db
      .select({
        source: signals.source,
        count: sql<number>`count(*)::int`,
      })
      .from(signals)
      .where(categoryId ? eq(signals.categoryId, categoryId) : undefined)
      .groupBy(signals.source)
      .orderBy(desc(sql`count(*)`));

    return results.map((r) => ({ source: r.source, count: r.count }));
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

    return results.map((r) => ({
      provider: r.provider || 'none',
      count: r.count,
    }));
  }

  async getTrends() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [volumeByDay, topSources, severityDistributionResult, aiStatsResult] =
      await Promise.all([
        this.db
          .select({
            date: sql<string>`TO_CHAR(signals.created_at, 'YYYY-MM-DD')`,
            count: sql<number>`count(*)::int`,
            high: sql<number>`count(*) FILTER (WHERE signals.severity = 'high')::int`,
            medium: sql<number>`count(*) FILTER (WHERE signals.severity = 'medium')::int`,
            low: sql<number>`count(*) FILTER (WHERE signals.severity = 'low')::int`,
          })
          .from(signals)
          .where(gte(signals.createdAt, thirtyDaysAgo))
          .groupBy(sql`TO_CHAR(signals.created_at, 'YYYY-MM-DD')`)
          .orderBy(sql`TO_CHAR(signals.created_at, 'YYYY-MM-DD')`),
        this.db
          .select({
            source: signals.source,
            count: sql<number>`count(*)::int`,
            avgScore: sql<number>`AVG(signals.score)::numeric(10,1)`,
          })
          .from(signals)
          .where(gte(signals.createdAt, thirtyDaysAgo))
          .groupBy(signals.source)
          .orderBy(desc(sql`count(*)`))
          .limit(5),
        this.db
          .select({
            severity: signals.severity,
            count: sql<number>`count(*)::int`,
          })
          .from(signals)
          .where(gte(signals.createdAt, thirtyDaysAgo))
          .groupBy(signals.severity),
        this.db
          .select({
            processed: sql<number>`count(*) FILTER (WHERE signals.ai_processed = true)::int`,
            failed: sql<number>`count(*) FILTER (WHERE signals.ai_failed = true)::int`,
            local: sql<number>`count(*) FILTER (WHERE signals.ai_provider = 'local' AND signals.ai_processed = true)::int`,
            groq: sql<number>`count(*) FILTER (WHERE signals.ai_provider = 'groq' AND signals.ai_processed = true)::int`,
            openrouter: sql<number>`count(*) FILTER (WHERE signals.ai_provider = 'openrouter' AND signals.ai_processed = true)::int`,
          })
          .from(signals)
          .where(gte(signals.createdAt, thirtyDaysAgo)),
      ]);

    const [categoryBreakdown] = await Promise.all([
      this.db
        .select({
          category: categories.name,
          count: sql<number>`count(*)::int`,
        })
        .from(signals)
        .innerJoin(categories, eq(signals.categoryId, categories.slug))
        .where(gte(signals.createdAt, thirtyDaysAgo))
        .groupBy(categories.name)
        .orderBy(desc(sql`count(*)`)),
    ]);

    const severityDistribution = {
      high: 0,
      medium: 0,
      low: 0,
    };
    severityDistributionResult.forEach((row) => {
      if (row.severity === 'high') {
        severityDistribution.high = row.count;
      } else if (row.severity === 'medium') {
        severityDistribution.medium = row.count;
      } else if (row.severity === 'low') {
        severityDistribution.low = row.count;
      }
    });

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
      volumeByDay: volumeByDay.map((day) => ({
        date: day.date,
        count: day.count,
        high: day.high,
        medium: day.medium,
        low: day.low,
      })),
      topSources: topSources.map((source) => ({
        source: source.source,
        count: source.count,
        avgScore: Number(source.avgScore),
      })),
      categoryBreakdown: categoryBreakdown.map((cat) => ({
        category: cat.category,
        count: cat.count,
      })),
      severityDistribution,
      aiStats,
    };
  }

  async getGeoStats(): Promise<{ country: string; count: number }[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const results = await this.db
      .select({
        country: signals.countryCode,
        count: sql<number>`count(*)::int`,
      })
      .from(signals)
      .where(
        and(
          gte(signals.createdAt, thirtyDaysAgo),
          isNotNull(signals.countryCode),
        ),
      )
      .groupBy(signals.countryCode)
      .orderBy(desc(sql`count(*)`));

    return results
      .filter((r) => r.country)
      .map((r) => ({ country: r.country!, count: r.count }));
  }

  async updateTranslations(id: string, translations: any) {
    await this.db
      .update(signals)
      .set({ translations })
      .where(eq(signals.id, id));
  }

  async setTranslation(
    id: string,
    lang: string,
    data: { title: string; aiSummary: string; v: number },
  ): Promise<void> {
    await this.db.execute(sql`
      UPDATE signals
      SET translations = jsonb_set(
        COALESCE(translations, '{}'),
        ${`{${lang}}`},
        ${JSON.stringify(data)}::jsonb
      )
      WHERE id = ${id}
    `);
  }

  async findById(id: string): Promise<Signal | null> {
    const [result] = await this.db
      .select()
      .from(signals)
      .where(eq(signals.id, id))
      .limit(1);
    return result || null;
  }
}
