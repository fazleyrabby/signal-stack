import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  slug: varchar('slug', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  url: text('url').notNull(),
  categoryId: varchar('category_id', { length: 50 }).notNull().references(() => categories.slug),
  trustScore: integer('trust_score').notNull().default(3),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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
    categoryId: varchar('category_id', { length: 50 }).notNull().references(() => categories.slug),
    aiCategory: varchar('ai_category', { length: 50 }),
    severity: varchar('severity', { length: 10 }).notNull(),
    hash: varchar('hash', { length: 64 }).notNull().unique(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    aiSummary: text('ai_summary'),
    aiProvider: varchar('ai_provider', { length: 20 }),
    aiProcessed: boolean('ai_processed').notNull().default(false),
    aiFailed: boolean('ai_failed').notNull().default(false),
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
  }),
);

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
