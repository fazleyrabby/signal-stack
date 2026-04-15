import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { categories, sources, signals, bookmarks, Signal } from '../database/schema';
import { eq, and, gte, or, ilike, lt, SQL, desc, asc, sql, inArray } from 'drizzle-orm';
import { BackupService } from '../database/backup.service';
import { TranslationQueue } from '../ai/translation.queue';
import { RedisService } from '../ai/redis.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly backupService: BackupService,
    private readonly translationQueue: TranslationQueue,
    private readonly redis: RedisService,
  ) {}

  async triggerBackup() {
    return this.backupService.triggerManualBackup();
  }

  async getFailedAISignals() {
    return this.db
      .select({
        id: signals.id,
        title: signals.title,
        content: signals.content,
        score: signals.score,
      })
      .from(signals)
      .where(eq(signals.aiProcessed, false))
      .orderBy(desc(signals.score))
      .limit(50);
  }

  async getHighSeverityUnprocessed() {
    return this.db
      .select({
        id: signals.id,
        title: signals.title,
        content: signals.content,
        score: signals.score,
      })
      .from(signals)
      .where(and(eq(signals.severity, 'high'), eq(signals.aiProcessed, false)))
      .limit(100);
  }

  // --- Categories ---

  async getCategories() {
    return this.db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(data: typeof categories.$inferInsert) {
    const [result] = await this.db.insert(categories).values(data).returning();
    return result;
  }

  async updateCategory(
    slug: string,
    data: Partial<typeof categories.$inferInsert>,
  ) {
    const [result] = await this.db
      .update(categories)
      .set(data)
      .where(eq(categories.slug, slug))
      .returning();
    return result;
  }

  async deleteCategory(slug: string) {
    const [result] = await this.db
      .delete(categories)
      .where(eq(categories.slug, slug))
      .returning();
    return result;
  }

  // --- Sources ---

  async getSources() {
    return this.db.select().from(sources).orderBy(sources.name);
  }

  async createSource(data: typeof sources.$inferInsert) {
    const [result] = await this.db.insert(sources).values(data).returning();
    return result;
  }

  async updateSource(id: string, data: Partial<typeof sources.$inferInsert>) {
    const [result] = await this.db
      .update(sources)
      .set(data)
      .where(eq(sources.id, id))
      .returning();
    return result;
  }

  async deleteSource(id: string) {
    const [result] = await this.db
      .delete(sources)
      .where(eq(sources.id, id))
      .returning();
    return result;
  }

  // --- Signal CRUD (Admin) ---

  async listSignals(params: {
    page: number;
    limit: number;
    severity?: string;
    source?: string;
    categoryId?: string;
    since?: Date;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    minScore?: number;
    hasTranslation?: boolean;
    translationLang?: string;
  }) {
    const { page, limit, severity, source, categoryId, since, search, sort = 'created_at', order = 'desc', minScore, hasTranslation, translationLang } = params;
    const offset = (page - 1) * limit;
    const conditions: SQL[] = [];

    if (severity) conditions.push(eq(signals.severity, severity));
    if (source) conditions.push(eq(signals.source, source));
    if (categoryId) conditions.push(eq(signals.categoryId, categoryId));
    if (since) conditions.push(gte(signals.createdAt, since));
    if (minScore !== undefined) conditions.push(gte(signals.score, minScore));
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(ilike(signals.title, term), ilike(signals.summary, term)) as SQL);
    }
    if (hasTranslation === true) conditions.push(sql`translations IS NOT NULL AND translations != '{}'::jsonb`);
    else if (hasTranslation === false) conditions.push(sql`(translations IS NULL OR translations = '{}'::jsonb)`);
    if (translationLang) conditions.push(sql`translations ? ${translationLang}`);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn =
      sort === 'score' ? signals.score :
      sort === 'severity' ? signals.severity :
      sort === 'published_at' ? signals.publishedAt :
      signals.createdAt;
    const orderFn = order === 'asc' ? asc : desc;

    const [data, countResult] = await Promise.all([
      this.db.select().from(signals).where(whereClause).orderBy(orderFn(sortColumn)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(signals).where(whereClause),
    ]);

    return {
      data,
      meta: { page, limit, total: countResult[0]?.count || 0, totalPages: Math.ceil((countResult[0]?.count || 0) / limit) },
    };
  }

  async getSignalById(id: string): Promise<Signal | null> {
    const [result] = await this.db.select().from(signals).where(eq(signals.id, id)).limit(1);
    return result || null;
  }

  async updateSignal(id: string, data: Partial<Signal>): Promise<Signal | null> {
    const [result] = await this.db
      .update(signals)
      .set({ ...data })
      .where(eq(signals.id, id))
      .returning();
    return result || null;
  }

  async deleteSignal(id: string): Promise<void> {
    // Delete bookmarks first (FK constraint)
    await this.db.delete(bookmarks).where(eq(bookmarks.signalId, id));
    await this.db.delete(signals).where(eq(signals.id, id));
    // Invalidate all language cache entries
    await this.redis.del(`sig_cache:${id}:en`);
    // We can't enumerate all languages, but common ones
    for (const lang of ['es', 'bn', 'fr', 'de', 'ar', 'zh']) {
      await this.redis.del(`sig_cache:${id}:${lang}`);
    }
  }

  async bulkEnqueueTranslations(
    lang: string,
    signalIds?: string[],
    filter?: { severity?: string; minScore?: number; since?: string; categoryId?: string },
  ): Promise<number> {
    let rows: { id: string; title: string; aiSummary: string | null; score: number }[] = [];

    if (signalIds && signalIds.length > 0) {
      rows = await this.db
        .select({ id: signals.id, title: signals.title, aiSummary: signals.aiSummary, score: signals.score })
        .from(signals)
        .where(inArray(signals.id, signalIds));
    } else if (filter) {
      const conditions: SQL[] = [sql`translations ? ${lang} = false`];
      if (filter.severity) conditions.push(eq(signals.severity, filter.severity));
      if (filter.minScore !== undefined) conditions.push(gte(signals.score, filter.minScore));
      if (filter.since) conditions.push(gte(signals.createdAt, new Date(filter.since)));
      if (filter.categoryId) conditions.push(eq(signals.categoryId, filter.categoryId));
      rows = await this.db
        .select({ id: signals.id, title: signals.title, aiSummary: signals.aiSummary, score: signals.score })
        .from(signals)
        .where(and(...conditions))
        .limit(200);
    }

    let queued = 0;
    for (const row of rows) {
      if (!row.aiSummary) continue;
      await this.translationQueue.enqueue(
        { id: row.id, title: row.title, summary: row.aiSummary, lang },
        'HIGH',
      );
      queued++;
    }
    return queued;
  }

  async resetBoilerplateSignals() {
    const boilerplatePhrases = [
      '%I don\'t see any content provided%',
      '%Please provide the content%',
      '%No content provided%',
      '%provide the content for me to summarize%',
      '%As an AI language model%',
    ];

    const conditions = boilerplatePhrases.map((phrase) =>
      ilike(signals.aiSummary, phrase),
    );

    return this.db
      .update(signals)
      .set({
        aiSummary: null,
        aiProcessed: false,
        aiFailed: false,
        aiProvider: null,
      })
      .where(or(...conditions))
      .returning({
        id: signals.id,
        title: signals.title,
        content: signals.content,
        score: signals.score,
      });
  }
}
