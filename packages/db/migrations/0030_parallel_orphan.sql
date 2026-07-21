DROP INDEX "idx_domace_claims_search_fts";--> statement-breakpoint
DROP INDEX "idx_emotive_claims_search_fts";--> statement-breakpoint
CREATE INDEX "idx_employees_full_name_fts" ON "employees" USING gin (to_tsvector('simple', "full_name"));--> statement-breakpoint
CREATE INDEX "idx_engine_types_code_fts" ON "engine_types" USING gin (to_tsvector('simple', "code"));--> statement-breakpoint
CREATE INDEX "idx_domace_claims_search_fts" ON "domace_claims" USING gin (to_tsvector('simple', coalesce("warranty_report", '') || ' ' || coalesce("mr_number", '') || ' ' || coalesce("customer_name", '') || ' ' || coalesce("claim_number", '')));--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_search_fts" ON "emotive_claims" USING gin (to_tsvector('simple', coalesce("warranty_report", '') || ' ' || "mr_number" || ' ' || coalesce("claim_number", '')));