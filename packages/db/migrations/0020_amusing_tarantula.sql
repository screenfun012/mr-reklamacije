CREATE TABLE "client_activation_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_activation_tokens" ADD CONSTRAINT "client_activation_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_activation_tokens_token_hash_key" ON "client_activation_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_client_activation_tokens_user_id" ON "client_activation_tokens" USING btree ("user_id");