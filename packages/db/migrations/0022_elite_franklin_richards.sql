DROP INDEX "idx_domace_claims_warranty_customer_fts";--> statement-breakpoint
DROP INDEX "idx_emotive_claims_warranty_report_fts";--> statement-breakpoint
CREATE INDEX "idx_customers_name_fts" ON "customers" USING gin (to_tsvector('simple', "name"));--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at_id" ON "audit_log" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity_type_created_at" ON "audit_log" USING btree ("entity_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_domace_claim_faults_external_party_id" ON "domace_claim_faults" USING btree ("external_party_id");--> statement-breakpoint
CREATE INDEX "idx_domace_claims_search_fts" ON "domace_claims" USING gin (to_tsvector('simple', coalesce("warranty_report", '') || ' ' || coalesce("mr_number", '') || ' ' || coalesce("customer_name", '')));--> statement-breakpoint
CREATE INDEX "idx_emotive_claim_faults_external_party_id" ON "emotive_claim_faults" USING btree ("external_party_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claims_search_fts" ON "emotive_claims" USING gin (to_tsvector('simple', coalesce("warranty_report", '') || ' ' || "mr_number"));