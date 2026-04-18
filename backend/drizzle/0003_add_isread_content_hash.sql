ALTER TABLE "jobs" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_jobs_content_hash" ON "jobs" USING btree ("content_hash");