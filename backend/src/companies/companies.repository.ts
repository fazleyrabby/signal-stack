import { Injectable, Inject } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { companies, Company, NewCompany } from '../database/schema';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';

@Injectable()
export class CompaniesRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: DrizzleDB) {}

  async save(data: Omit<NewCompany, 'id' | 'createdAt'>): Promise<Company> {
    const [inserted] = await this.db.insert(companies).values(data).returning();
    return inserted;
  }

  async findAll(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(companies)
        .orderBy(desc(companies.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(companies),
    ]);

    return {
      data,
      total: countResult[0]?.count || 0,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(companies).where(sql`${companies.id} = ${id}`);
  }
}
