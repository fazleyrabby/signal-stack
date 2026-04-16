CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"slug" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"source" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"company" varchar(200),
	"location" varchar(200),
	"remote" boolean,
	"job_type" varchar(50),
	"salary_range" varchar(100),
	"experience_level" varchar(50),
	"description" text,
	"url" text NOT NULL,
	"hash" varchar(64) NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"summary" text,
	"url" text NOT NULL,
	"score" integer NOT NULL,
	"category_id" varchar(50) NOT NULL,
	"ai_category" varchar(50),
	"severity" varchar(10) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"published_at" timestamp with time zone,
	"ai_summary" text,
	"ai_provider" varchar(20),
	"ai_processed" boolean DEFAULT false NOT NULL,
	"ai_failed" boolean DEFAULT false NOT NULL,
	"country_code" varchar(2),
	"translations" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" text NOT NULL,
	"category_id" varchar(50) NOT NULL,
	"type" varchar(20) DEFAULT 'signal' NOT NULL,
	"trust_score" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"ip" varchar(45),
	"user_agent" text,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"page_views" integer DEFAULT 1 NOT NULL,
	"country" text,
	"city" text,
	"latitude" double precision,
	"longitude" double precision,
	"timezone" text,
	"isp" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	CONSTRAINT "visitors_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_category_id_categories_slug_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_category_id_categories_slug_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookmarks_signal_id_session_id" ON "bookmarks" USING btree ("signal_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bookmarks_signal_id_session_id" ON "bookmarks" USING btree ("signal_id","session_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_hash" ON "jobs" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_jobs_created_at" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_company" ON "jobs" USING btree ("company");--> statement-breakpoint
CREATE INDEX "idx_jobs_remote" ON "jobs" USING btree ("remote");--> statement-breakpoint
CREATE INDEX "idx_signals_created_at" ON "signals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_signals_category_id" ON "signals" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_signals_severity" ON "signals" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_signals_score" ON "signals" USING btree ("score");--> statement-breakpoint
CREATE INDEX "idx_signals_hash" ON "signals" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "idx_signals_country_code" ON "signals" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "idx_visitors_ip" ON "visitors" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "idx_visitors_country" ON "visitors" USING btree ("country");