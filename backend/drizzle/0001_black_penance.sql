ALTER TABLE "sources" ADD COLUMN "parser_hint" varchar(20) DEFAULT 'rss';--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "parser_config" jsonb DEFAULT '{}'::jsonb;