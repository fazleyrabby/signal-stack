import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  doublePrecision,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const categories = pgTable('categories', {
  slug: varchar('slug', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  url: text('url').notNull(),
  categoryId: varchar('category_id', { length: 50 })
    .notNull()
    .references(() => categories.slug),
  type: varchar('type', { length: 20 }).notNull().default('signal'),
  parserHint: varchar('parser_hint', { length: 20 }).default('rss'),
  parserConfig: jsonb('parser_config').$type<Record<string, any>>().default({}),
  trustScore: integer('trust_score').notNull().default(3),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => sources.id),
    source: varchar('source', { length: 100 }).notNull(),
    title: text('title').notNull(),
    company: varchar('company', { length: 200 }),
    location: varchar('location', { length: 200 }),
    remote: boolean('remote'),
    jobType: varchar('job_type', { length: 50 }),
    salaryRange: varchar('salary_range', { length: 100 }),
    experienceLevel: varchar('experience_level', { length: 50 }),
    description: text('description'),
    url: text('url').notNull(),
    hash: varchar('hash', { length: 64 }).notNull().unique(),
    tags: jsonb('tags').$type<string[]>().default([]),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    hashIdx: index('idx_jobs_hash').on(table.hash),
    createdAtIdx: index('idx_jobs_created_at').on(table.createdAt),
    companyIdx: index('idx_jobs_company').on(table.company),
    remoteIdx: index('idx_jobs_remote').on(table.remote),
    sourceIdx: index('idx_jobs_source').on(table.source),
  }),
);

export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: varchar('source', { length: 100 }).notNull(),
    title: text('title').notNull(),
    content: text('content'),
    summary: text('summary'),
    url: text('url').notNull(),
    score: integer('score').notNull(),
    categoryId: varchar('category_id', { length: 50 })
      .notNull()
      .references(() => categories.slug),
    aiCategory: varchar('ai_category', { length: 50 }),
    severity: varchar('severity', { length: 10 }).notNull(),
    hash: varchar('hash', { length: 64 }).notNull().unique(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    aiSummary: text('ai_summary'),
    aiProvider: varchar('ai_provider', { length: 20 }),
    aiProcessed: boolean('ai_processed').notNull().default(false),
    aiFailed: boolean('ai_failed').notNull().default(false),
    countryCode: varchar('country_code', { length: 2 }),
    translations: jsonb('translations').$type<Record<string, { title: string; aiSummary: string }>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    createdAtIdx: index('idx_signals_created_at').on(table.createdAt),
    categoryIdIdx: index('idx_signals_category_id').on(table.categoryId),
    severityIdx: index('idx_signals_severity').on(table.severity),
    scoreIdx: index('idx_signals_score').on(table.score),
    hashIdx: index('idx_signals_hash').on(table.hash),
    countryCodeIdx: index('idx_signals_country_code').on(table.countryCode),
  }),
);

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const settings = pgTable('settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const visitors = pgTable(
  'visitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: varchar('session_id', { length: 64 }).notNull().unique(),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    firstSeen: timestamp('first_seen', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true })
      .notNull()
      .defaultNow(),
    pageViews: integer('page_views').notNull().default(1),
    country: text('country'),
    city: text('city'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    timezone: text('timezone'),
    isp: text('isp'),
    isBot: boolean('is_bot').notNull().default(false),
  },
  (table) => ({
    ipIdx: index('idx_visitors_ip').on(table.ip),
    countryIdx: index('idx_visitors_country').on(table.country),
  }),
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    signalId: uuid('signal_id')
      .notNull()
      .references(() => signals.id),
    sessionId: varchar('session_id', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    signalSessionIdx: index('idx_bookmarks_signal_id_session_id').on(
      table.signalId,
      table.sessionId,
    ),
    uniqueSignalSession: uniqueIndex('uq_bookmarks_signal_id_session_id').on(
      table.signalId,
      table.sessionId,
    ),
  }),
);

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    website: text('website'),
    careerUrl: text('career_url'),
    careerPageFound: boolean('career_page_found').notNull().default(false),
    city: varchar('city', { length: 100 }),
    country: varchar('country', { length: 100 }),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    osmId: varchar('osm_id', { length: 50 }),
    source: varchar('source', { length: 50 }).notNull().default('osm'),
    tags: jsonb('tags').$type<string[]>().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    osmIdIdx: index('idx_companies_osm_id').on(table.osmId),
    createdAtIdx: index('idx_companies_created_at').on(table.createdAt),
    nameSourceUniq: uniqueIndex('uq_companies_name_source').on(table.name, table.source),
    sourceIdx: index('idx_companies_source').on(table.source),
    cityIdx: index('idx_companies_city').on(table.city),
  }),
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Visitor = typeof visitors.$inferSelect;
export type NewVisitor = typeof visitors.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
