import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, asc, sql, and, gte, SQL, or, ilike } from 'drizzle-orm';
import { jobs, Signal, sources } from '../database/schema';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';

@Injectable()
export class JobsRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB) {}

  /**
   * Check if a job hash already exists
   */
  async hashExists(hash: string): Promise<boolean> {
    const result = await this.db
      .select({ hash: jobs.hash })
      .from(jobs)
      .where(eq(jobs.hash, hash))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Insert a new job
   */
  async insert(data: any): Promise<any> {
    try {
      const [inserted] = await this.db.insert(jobs).values(data).returning();
      return inserted;
    } catch (error: any) {
      if (error?.code === '23505') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find jobs with pagination and filters
   */
  async findAll(params: {
    page: number;
    limit: number;
    source?: string;
    remote?: boolean;
    company?: string;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const { page, limit, source, remote, company, search, sort = 'createdAt', order = 'desc' } = params;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (source) conditions.push(eq(jobs.source, source));
    if (remote !== undefined) conditions.push(eq(jobs.remote, remote));
    if (company) conditions.push(ilike(jobs.company, `%${company}%`));
    if (search) {
      const term = `%${search}%`;
      conditions.push(
        or(
          ilike(jobs.title, term),
          ilike(jobs.description, term),
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${jobs.tags}) AS t WHERE t ILIKE ${term})`
        ) as SQL
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumns: Record<string, any> = {
      title: jobs.title,
      company: jobs.company,
      location: jobs.location,
      source: jobs.source,
      createdAt: jobs.createdAt,
      publishedAt: jobs.publishedAt,
    };
    const sortCol = sortColumns[sort] ?? jobs.createdAt;
    const orderFn = order === 'asc' ? asc : desc;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(jobs)
        .where(whereClause)
        .orderBy(orderFn(sortCol))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(whereClause),
    ]);

    return {
      data,
      total: countResult[0]?.count || 0,
    };
  }

  /**
   * Remove stale jobs
   */
  async cleanup(days: number): Promise<number> {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db
      .delete(jobs)
      .where(sql`${jobs.createdAt} < ${threshold}`)
      .returning({ id: jobs.id });
    
    return result.length;
  }

  /**
   * Get active job sources
   */
  async getActiveSources() {
    return this.db
      .select()
      .from(sources)
      .where(and(eq(sources.type, 'job'), eq(sources.isActive, true)));
  }
}
