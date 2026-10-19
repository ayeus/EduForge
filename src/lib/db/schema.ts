import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["student", "instructor", "admin"]);
export const courseStatusEnum = pgEnum("course_status", ["draft", "published"]);
export const levelEnum = pgEnum("course_level", ["beginner", "intermediate", "advanced"]);
export const liveStatusEnum = pgEnum("live_status", ["scheduled", "live", "ended"]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "message",
  "live",
  "announcement",
  "lesson",
  "certificate",
  "review",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("student"),
    bio: text("bio"),
    /** Bumped while the user has the app open; drives "online" indicators. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** Sessions issued before this are rejected, so a password change signs out other devices. */
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 140 }).notNull(),
    summary: varchar("summary", { length: 280 }).notNull().default(""),
    description: text("description").notNull().default(""),
    category: varchar("category", { length: 60 }).notNull().default("General"),
    level: levelEnum("level").notNull().default("beginner"),
    coverKey: text("cover_key"),
    status: courseStatusEnum("status").notNull().default("draft"),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("courses_instructor_idx").on(t.instructorId),
    index("courses_status_idx").on(t.status),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 140 }).notNull(),
    content: text("content").notNull().default(""),
    videoKey: text("video_key"),
    attachmentKey: text("attachment_key"),
    attachmentName: varchar("attachment_name", { length: 255 }),
    durationSeconds: integer("duration_seconds"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("lessons_course_idx").on(t.courseId, t.position)],
);

export const enrollments = pgTable(
  "enrollments",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lastLessonId: uuid("last_lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.courseId] }),
    index("enrollments_course_idx").on(t.courseId),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    positionSeconds: integer("position_seconds").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

/**
 * Course-scoped conversation between a student and the course instructor.
 * One thread per (course, student); both sides post into it.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_thread_idx").on(t.courseId, t.studentId, t.createdAt)],
);

/* ───────────────────────────── Live classes ───────────────────────────── */

/** A scheduled broadcast for a course, streamed through a Mux live stream. */
export const liveSessions = pgTable(
  "live_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 140 }).notNull(),
    description: text("description").notNull().default(""),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: liveStatusEnum("status").notNull().default("scheduled"),
    muxStreamId: text("mux_stream_id"),
    /** Secret: anyone holding it can broadcast. Only ever sent to the course owner. */
    muxStreamKey: text("mux_stream_key"),
    muxPlaybackId: text("mux_playback_id"),
    signedPlayback: boolean("signed_playback").notNull().default(false),
    /** Last time the encoder state was pulled from Mux; throttles status syncs. */
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    replayAssetId: text("replay_asset_id"),
    replayPlaybackId: text("replay_playback_id"),
    pinnedNote: varchar("pinned_note", { length: 280 }),
    /** How the class is broadcast: straight from the host's browser (WebRTC) or via an encoder to Mux. */
    broadcastMode: varchar("broadcast_mode", { length: 16 }).$type<"browser" | "encoder">(),
    /** Who is broadcasting from their browser; viewers connect to this person. */
    broadcasterId: uuid("broadcaster_id").references(() => users.id, { onDelete: "set null" }),
    /** Heartbeat from the broadcasting browser; a silent host ends the class automatically. */
    hostSeenAt: timestamp("host_seen_at", { withTimezone: true }),
    /** Storage keys of browser-recorded segments, played back in order as the replay. */
    recordingKeys: jsonb("recording_keys").$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    index("live_sessions_course_idx").on(t.courseId, t.scheduledFor),
    index("live_sessions_status_idx").on(t.status),
    uniqueIndex("live_sessions_mux_stream_idx").on(t.muxStreamId),
  ],
);

export const liveChatMessages = pgTable(
  "live_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => liveSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("live_chat_session_idx").on(t.sessionId, t.createdAt)],
);

/** Who is watching right now. Rows are refreshed by the viewer's realtime connection. */
export const livePresence = pgTable(
  "live_presence",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => liveSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

/* ───────────────────────── Notifications & realtime ───────────────────────── */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: varchar("body", { length: 280 }).notNull().default(""),
    href: text("href").notNull(),
    /** Unread notifications sharing a key collapse into one (e.g. a busy chat thread). */
    groupKey: varchar("group_key", { length: 160 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("notifications_unread_group_idx")
      .on(t.userId, t.groupKey)
      .where(sql`${t.readAt} is null and ${t.groupKey} is not null`),
  ],
);

/**
 * Durable event log behind the realtime connection. Inserts are announced with NOTIFY;
 * reconnecting clients replay what they missed from here. Pruned after a day.
 */
export const realtimeEvents = pgTable(
  "realtime_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    topic: varchar("topic", { length: 120 }).notNull(),
    type: varchar("type", { length: 60 }).notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("realtime_events_topic_idx").on(t.topic, t.id), index("realtime_events_created_idx").on(t.createdAt)],
);

/* ─────────────────────── Announcements, reviews, certificates ─────────────────────── */

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 140 }).notNull(),
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("announcements_course_idx").on(t.courseId, t.createdAt)],
);

export const reviews = pgTable(
  "reviews",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    body: text("body").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.courseId] }),
    index("reviews_course_idx").on(t.courseId, t.createdAt),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);

/** Issued once a student completes every lesson. The id doubles as the public verification code. */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("certificates_user_course_idx").on(t.userId, t.courseId)],
);

/* ───────────────────────────────── Quizzes ───────────────────────────────── */

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctIndex: smallint("correct_index").notNull(),
    explanation: text("explanation").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("quiz_questions_lesson_idx").on(t.lessonId, t.position)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    answers: jsonb("answers").$type<number[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quiz_attempts_user_lesson_idx").on(t.userId, t.lessonId, t.createdAt)],
);

export const usersRelations = relations(users, ({ many }) => ({
  courses: many(courses),
  enrollments: many(enrollments),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  instructor: one(users, { fields: [courses.instructorId], references: [users.id] }),
  lessons: many(lessons),
  enrollments: many(enrollments),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  course: one(courses, { fields: [lessons.courseId], references: [courses.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, { fields: [enrollments.courseId], references: [courses.id] }),
}));

export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type LiveSession = typeof liveSessions.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type LiveStatus = (typeof liveStatusEnum.enumValues)[number];
export type NotificationKind = (typeof notificationKindEnum.enumValues)[number];
export type Level = (typeof levelEnum.enumValues)[number];
