ALTER TABLE "users" ADD COLUMN "push_mode" text;--> statement-breakpoint
UPDATE "users" AS u
SET "push_mode" = legacy."mode"
FROM (
	SELECT
		"user_id",
		CASE
			WHEN BOOL_OR("mode" = 'no_text') THEN 'no_text'
			WHEN BOOL_OR("mode" = 'mentions') THEN 'mentions'
			ELSE 'all'
		END AS "mode"
	FROM "push_subscriptions"
	GROUP BY "user_id"
) AS legacy
WHERE u."id" = legacy."user_id" AND u."push_mode" IS NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_push_subscriptions_session_id" ON "push_subscriptions" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_push_mode_check" CHECK ("users"."push_mode" IN ('all', 'mentions', 'no_text'));
