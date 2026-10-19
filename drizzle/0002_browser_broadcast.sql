ALTER TABLE "live_sessions" ADD COLUMN "broadcast_mode" varchar(16);--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "broadcaster_id" uuid;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "host_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "recording_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_broadcaster_id_users_id_fk" FOREIGN KEY ("broadcaster_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;