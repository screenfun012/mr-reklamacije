CREATE TABLE "emotive_claim_client_views" (
	"user_id" uuid NOT NULL,
	"emotive_claim_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "emotive_claim_client_views_user_id_emotive_claim_id_pk" PRIMARY KEY("user_id","emotive_claim_id")
);
--> statement-breakpoint
ALTER TABLE "emotive_claims" ADD COLUMN "client_content_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "emotive_claim_client_views" ADD CONSTRAINT "emotive_claim_client_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotive_claim_client_views" ADD CONSTRAINT "emotive_claim_client_views_claim_id_fkey" FOREIGN KEY ("emotive_claim_id") REFERENCES "public"."emotive_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_emotive_claim_client_views_claim_id" ON "emotive_claim_client_views" USING btree ("emotive_claim_id");