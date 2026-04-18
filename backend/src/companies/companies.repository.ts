import { Injectable, Inject } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import { companies, Company, NewCompany } from '../database/schema';
import { DATABASE_CONNECTION } from '../database/database.module';
import type { DrizzleDB } from '../database/database.module';

// Names that indicate non-tech companies to exclude
const NON_TECH_EXCLUDE = /\b(bank|banks|banking|finance|financial|insurance|leasing|hospital|clinic|pharmacy|pharma|restaurant|hotel|real estate|realty|property|construction|garments|textile|apparel|fashion|food|beverage|grocery|supermarket|retail|trade|import|export|transport|shipping|logistics|airline|travel|tourism|news|media|newspaper|school|college|university|ngo|foundation|charity|government|ministry|embassy|consulate|chamber of commerce)\b/i;

// Names that confirm tech companies — any match = keep
const TECH_CONFIRM = /\b(software|tech|technology|technologies|digital|IT|ICT|solutions|systems|apps|application|web|mobile|cloud|data|cyber|network|telecom|fintech|e-commerce|ecommerce|startup|dev|development|code|coding|programming|platform|SaaS|AI|ML|ERP|CRM|automation|robotics|semiconductor|hardware|electronics)\b/i;

// Sources that are inherently tech (always keep)
const TECH_SOURCES = new Set(['basis', 'bacco', 'github_bd', 'ecab']);

export function isTechCompany(name: string, source: string, tags: string[]): boolean {
  // Directory crawler sources are pre-filtered as tech
  if (TECH_SOURCES.has(source)) return true;

  // Tag-based: if any OSM tag is explicitly tech
  const tagStr = tags.join(' ').toLowerCase();
  if (/\b(software|tech|it|coworking|startup)\b/.test(tagStr)) return true;

  // Name-based: confirm tech keywords
  if (TECH_CONFIRM.test(name)) return true;

  // Name-based: exclude known non-tech sectors
  if (NON_TECH_EXCLUDE.test(name)) return false;

  // OSM "company" with no further signal — exclude by default
  return false;
}

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

    // Filter at DB level: keep only tech sources or tech-keyword names
    const techFilter = sql`(
      source = ANY(ARRAY['basis','bacco','github_bd','ecab'])
      OR tags::text ~* '\\y(software|tech|it|coworking|startup)\\y'
      OR name ~* '\\y(software|tech|technology|technologies|digital|ICT|solutions|systems|apps|application|web|mobile|cloud|data|cyber|network|telecom|fintech|e-commerce|ecommerce|startup|dev|development|platform|SaaS|AI|ML|ERP|CRM|automation|robotics|semiconductor|hardware|electronics)\\y'
    ) AND name !~* '\\y(bank|banks|banking|finance|financial|insurance|leasing|hospital|clinic|pharmacy|pharma|restaurant|hotel|real estate|realty|property|construction|garments|textile|apparel|fashion|food|beverage|grocery|supermarket|retail|trade|import|export|transport|shipping|airline|travel|tourism|newspaper|school|college|university|ngo|foundation|charity|government|ministry|embassy|consulate)\\y'`;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(companies)
        .where(techFilter)
        .orderBy(desc(companies.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(companies).where(techFilter),
    ]);

    return {
      data,
      total: countResult[0]?.count || 0,
    };
  }

  async purgeNonTech(): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM companies
      WHERE NOT (
        source = ANY(ARRAY['basis','bacco','github_bd','ecab'])
        OR tags::text ~* '\\y(software|tech|it|coworking|startup)\\y'
        OR name ~* '\\y(software|tech|technology|technologies|digital|ICT|solutions|systems|apps|application|web|mobile|cloud|data|cyber|network|telecom|fintech|e-commerce|ecommerce|startup|dev|development|platform|SaaS|AI|ML|ERP|CRM|automation|robotics|semiconductor|hardware|electronics)\\y'
      )
      OR name ~* '\\y(bank|banks|banking|finance|financial|insurance|leasing|hospital|clinic|pharmacy|pharma|restaurant|hotel|real estate|realty|property|construction|garments|textile|apparel|fashion|food|beverage|grocery|supermarket|retail|trade|import|export|transport|shipping|airline|travel|tourism|newspaper|school|college|university|ngo|foundation|charity|government|ministry|embassy|consulate)\\y'
    `);
    return (result as any).rowCount ?? 0;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(companies).where(sql`${companies.id} = ${id}`);
  }
}
