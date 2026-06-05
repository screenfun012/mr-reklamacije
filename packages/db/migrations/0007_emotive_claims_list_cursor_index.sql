CREATE INDEX "idx_emotive_claims_date_of_claim_id" ON "emotive_claims" USING btree ("date_of_claim" DESC NULLS LAST,"id" DESC);--> statement-breakpoint
