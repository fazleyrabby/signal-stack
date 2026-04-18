CREATE INDEX IF NOT EXISTS "idx_companies_source" ON "companies" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_companies_city" ON "companies" USING btree ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_source" ON "jobs" USING btree ("source");
