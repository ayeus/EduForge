CREATE TYPE "public"."live_status" AS ENUM('scheduled', 'live', 'ended');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('message', 'live', 'announcement', 'lesson', 'certificate', 'review');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" varchar(140) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_presence" (
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_presence_session_id_user_id_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar(140) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "live_status" DEFAULT 'scheduled' NOT NULL,
	"mux_stream_id" text,
	"mux_stream_key" text,
	"mux_playback_id" text,
	"signed_playback" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"replay_asset_id" text,
	"replay_playback_id" text,
	"pinned_note" varchar(280),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" varchar(280) DEFAULT '' NOT NULL,
	"href" text NOT NULL,
	"group_key" varchar(160),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"answers" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" smallint NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realtime_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"topic" varchar(120) NOT NULL,
	"type" varchar(60) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_user_id_course_id_pk" PRIMARY KEY("user_id","course_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_presence" ADD CONSTRAINT "live_presence_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_presence" ADD CONSTRAINT "live_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_course_idx" ON "announcements" USING btree ("course_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_course_idx" ON "certificates" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "live_chat_session_idx" ON "live_chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "live_sessions_course_idx" ON "live_sessions" USING btree ("course_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "live_sessions_status_idx" ON "live_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "live_sessions_mux_stream_idx" ON "live_sessions" USING btree ("mux_stream_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_unread_group_idx" ON "notifications" USING btree ("user_id","group_key") WHERE "notifications"."read_at" is null and "notifications"."group_key" is not null;--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_lesson_idx" ON "quiz_attempts" USING btree ("user_id","lesson_id","created_at");--> statement-breakpoint
CREATE INDEX "quiz_questions_lesson_idx" ON "quiz_questions" USING btree ("lesson_id","position");--> statement-breakpoint
CREATE INDEX "realtime_events_topic_idx" ON "realtime_events" USING btree ("topic","id");--> statement-breakpoint
CREATE INDEX "realtime_events_created_idx" ON "realtime_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reviews_course_idx" ON "reviews" USING btree ("course_id","created_at");