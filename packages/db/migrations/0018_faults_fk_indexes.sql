CREATE INDEX "idx_domace_claim_faults_claim_id" ON "domace_claim_faults" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_domace_claim_faults_employee_id" ON "domace_claim_faults" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_domace_claim_faults_department_id" ON "domace_claim_faults" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claim_faults_claim_id" ON "emotive_claim_faults" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claim_faults_employee_id" ON "emotive_claim_faults" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_emotive_claim_faults_department_id" ON "emotive_claim_faults" USING btree ("department_id");