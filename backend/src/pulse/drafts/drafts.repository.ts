import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import {
  pulseDrafts,
  pulseAccounts,
  pulsePublishLogs,
  settings,
  signals,
  type PulseDraft,
  type NewPulseDraft,
  type PulseAccount,
  type NewPulseAccount,
  type PulsePublishLog,
  type NewPulsePublishLog,
} from '../../database/schema';
import { eq, and, desc, count, lte, asc, ne, type SQL } from 'drizzle-orm';

@Injectable()
export class DraftsRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
  ) {}

  async findDrafts(filters: { status?: string; limit?: number; offset?: number }) {
    const conditions: SQL[] = [];
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(pulseDrafts.status, filters.status));
    }

    const query = this.db
      .select({
        id: pulseDrafts.id,
        sourceSignalId: pulseDrafts.sourceSignalId,
        platform: pulseDrafts.platform,
        text: pulseDrafts.text,
        status: pulseDrafts.status,
        scheduledAt: pulseDrafts.scheduledAt,
        publishedAt: pulseDrafts.publishedAt,
        aiProvider: pulseDrafts.aiProvider,
        aiModel: pulseDrafts.aiModel,
        retryCount: pulseDrafts.retryCount,
        metadata: pulseDrafts.metadata,
        createdAt: pulseDrafts.createdAt,
        updatedAt: pulseDrafts.updatedAt,
        signal: {
          id: signals.id,
          title: signals.title,
          url: signals.url,
          score: signals.score,
          severity: signals.severity,
          aiSummary: signals.aiSummary,
        },
      })
      .from(pulseDrafts)
      .leftJoin(signals, eq(pulseDrafts.sourceSignalId, signals.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pulseDrafts.createdAt));

    if (filters.limit) query.limit(filters.limit);
    if (filters.offset) query.offset(filters.offset);

    return query;
  }

  async countDrafts(status?: string) {
    const conditions: SQL[] = [];
    if (status && status !== 'all') {
      conditions.push(eq(pulseDrafts.status, status));
    }
    const result = await this.db
      .select({ val: count() })
      .from(pulseDrafts)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result[0]?.val || 0;
  }

  async findDraftById(id: string) {
    const results = await this.db
      .select({
        id: pulseDrafts.id,
        sourceSignalId: pulseDrafts.sourceSignalId,
        platform: pulseDrafts.platform,
        text: pulseDrafts.text,
        status: pulseDrafts.status,
        scheduledAt: pulseDrafts.scheduledAt,
        publishedAt: pulseDrafts.publishedAt,
        aiProvider: pulseDrafts.aiProvider,
        aiModel: pulseDrafts.aiModel,
        retryCount: pulseDrafts.retryCount,
        metadata: pulseDrafts.metadata,
        createdAt: pulseDrafts.createdAt,
        updatedAt: pulseDrafts.updatedAt,
        signal: {
          id: signals.id,
          title: signals.title,
          url: signals.url,
          score: signals.score,
          severity: signals.severity,
          aiSummary: signals.aiSummary,
        },
      })
      .from(pulseDrafts)
      .leftJoin(signals, eq(pulseDrafts.sourceSignalId, signals.id))
      .where(eq(pulseDrafts.id, id))
      .limit(1);
    return results[0] || null;
  }

  async createDraft(data: NewPulseDraft) {
    const results = await this.db.insert(pulseDrafts).values(data).returning();
    return results[0];
  }

  async updateDraft(id: string, data: Partial<NewPulseDraft>) {
    const results = await this.db
      .update(pulseDrafts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pulseDrafts.id, id))
      .returning();
    return results[0];
  }

  async deleteDraft(id: string): Promise<void> {
    await this.db.delete(pulseDrafts).where(eq(pulseDrafts.id, id));
  }

  async createPublishLog(data: NewPulsePublishLog) {
    const results = await this.db.insert(pulsePublishLogs).values(data).returning();
    return results[0];
  }

  async findPublishLogs(limit = 100) {
    return this.db
      .select()
      .from(pulsePublishLogs)
      .orderBy(desc(pulsePublishLogs.createdAt))
      .limit(limit);
  }

  async findActiveAccount(platform = 'x') {
    const results = await this.db
      .select()
      .from(pulseAccounts)
      .where(and(eq(pulseAccounts.platform, platform), eq(pulseAccounts.isActive, true)))
      .limit(1);
    return results[0] || null;
  }

  async findAllAccounts(platform = 'x') {
    return this.db
      .select()
      .from(pulseAccounts)
      .where(eq(pulseAccounts.platform, platform))
      .orderBy(desc(pulseAccounts.createdAt));
  }

  async findAllActiveAccounts() {
    return this.db
      .select()
      .from(pulseAccounts)
      .where(eq(pulseAccounts.isActive, true))
      .orderBy(asc(pulseAccounts.platform));
  }

  async draftExistsForSignalPlatform(signalId: string, platform: string): Promise<boolean> {
    const results = await this.db
      .select({ id: pulseDrafts.id })
      .from(pulseDrafts)
      .where(and(eq(pulseDrafts.sourceSignalId, signalId), eq(pulseDrafts.platform, platform)))
      .limit(1);
    return results.length > 0;
  }

  async createAccount(data: NewPulseAccount) {
    const results = await this.db.insert(pulseAccounts).values(data).returning();
    return results[0];
  }

  async updateAccount(id: string, data: Partial<NewPulseAccount>) {
    const results = await this.db
      .update(pulseAccounts)
      .set(data)
      .where(eq(pulseAccounts.id, id))
      .returning();
    return results[0];
  }

  async setActiveAccount(id: string, platform: string): Promise<void> {
    // Atomically deactivate all accounts for the platform, then activate the target.
    await this.db
      .update(pulseAccounts)
      .set({ isActive: false })
      .where(and(eq(pulseAccounts.platform, platform), ne(pulseAccounts.id, id)));
    await this.db
      .update(pulseAccounts)
      .set({ isActive: true })
      .where(eq(pulseAccounts.id, id));
  }

  async deleteAccount(id: string): Promise<void> {
    await this.db.delete(pulseAccounts).where(eq(pulseAccounts.id, id));
  }

  async findSetting(key: string): Promise<string | null> {
    const results = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return results[0]?.value || null;
  }

  async upsertSetting(key: string, value: string) {
    await this.db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  async findScheduledDraftsToPublish() {
    const results = await this.db
      .select()
      .from(pulseDrafts)
      .where(and(eq(pulseDrafts.status, 'scheduled'), lte(pulseDrafts.scheduledAt, new Date())))
      .orderBy(asc(pulseDrafts.scheduledAt));
    return results;
  }
}
