ALTER TABLE "ai_generations" ADD COLUMN "guest_ip_hash" text;--> statement-breakpoint
CREATE INDEX "ai_generations_guest_ip_idx" ON "ai_generations" USING btree ("guest_ip_hash");