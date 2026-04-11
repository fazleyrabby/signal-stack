import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';
import { categories, sources, signals } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { BackupService } from '../database/backup.service';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB,
    private readonly backupService: BackupService,
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
      .where(and(eq(signals.aiFailed, true), eq(signals.aiProcessed, false)))
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
}
