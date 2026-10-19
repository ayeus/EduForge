import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { announcements, reviews, users, quizQuestions, quizAttempts, certificates, courses, lessons } = schema;

/* ───────────────────────────── Announcements ───────────────────────────── */

export async function getAnnouncements(courseId: string, limit = 20) {
  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      createdAt: announcements.createdAt,
      authorName: users.name,
    })
    .from(announcements)
    .innerJoin(users, eq(users.id, announcements.authorId))
    .where(eq(announcements.courseId, courseId))
    .orderBy(desc(announcements.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/* ───────────────────────────────── Reviews ───────────────────────────────── */

export async function getReviewSummary(courseId: string) {
  const rows = await db
    .select({ rating: reviews.rating, n: count() })
    .from(reviews)
    .where(eq(reviews.courseId, courseId))
    .groupBy(reviews.rating);
  const total = rows.reduce((s, r) => s + r.n, 0);
  const sum = rows.reduce((s, r) => s + r.rating * r.n, 0);
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, n: rows.find((r) => r.rating === stars)?.n ?? 0 }));
  return { total, average: total ? Math.round((sum / total) * 10) / 10 : 0, distribution };
}

export async function getReviews(courseId: string, limit = 20) {
  const rows = await db
    .select({
      userId: reviews.userId,
      rating: reviews.rating,
      body: reviews.body,
      updatedAt: reviews.updatedAt,
      name: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.courseId, courseId))
    .orderBy(sql`length(${reviews.body}) > 0 desc`, desc(reviews.updatedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

export async function getMyReview(courseId: string, userId: string) {
  const [row] = await db
    .select({ rating: reviews.rating, body: reviews.body })
    .from(reviews)
    .where(and(eq(reviews.courseId, courseId), eq(reviews.userId, userId)))
    .limit(1);
  return row ?? null;
}

/* ───────────────────────────────── Quizzes ───────────────────────────────── */

/** Questions without the answers, plus the student's best attempt. */
export async function getQuizForStudent(lessonId: string, userId: string) {
  const [questions, [best]] = await Promise.all([
    db
      .select({ id: quizQuestions.id, prompt: quizQuestions.prompt, options: quizQuestions.options })
      .from(quizQuestions)
      .where(eq(quizQuestions.lessonId, lessonId))
      .orderBy(asc(quizQuestions.position)),
    db
      .select({ score: quizAttempts.score, total: quizAttempts.total, attempts: sql<number>`count(*) over ()::int` })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.lessonId, lessonId), eq(quizAttempts.userId, userId)))
      .orderBy(desc(sql`${quizAttempts.score}::float / ${quizAttempts.total}`), desc(quizAttempts.createdAt))
      .limit(1),
  ]);
  return { questions, best: best ?? null };
}

export async function getQuizForEditor(lessonId: string) {
  return db
    .select({
      prompt: quizQuestions.prompt,
      options: quizQuestions.options,
      correctIndex: quizQuestions.correctIndex,
      explanation: quizQuestions.explanation,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, lessonId))
    .orderBy(asc(quizQuestions.position));
}

/** Question counts per lesson for a course, keyed by lesson id. */
export async function getQuizCounts(courseId: string) {
  const rows = await db
    .select({ lessonId: quizQuestions.lessonId, n: count() })
    .from(quizQuestions)
    .innerJoin(lessons, eq(lessons.id, quizQuestions.lessonId))
    .where(eq(lessons.courseId, courseId))
    .groupBy(quizQuestions.lessonId);
  return Object.fromEntries(rows.map((r) => [r.lessonId, r.n])) as Record<string, number>;
}

/* ─────────────────────────────── Certificates ─────────────────────────────── */

export async function getCertificate(id: string) {
  const [row] = await db
    .select({
      id: certificates.id,
      issuedAt: certificates.issuedAt,
      userId: certificates.userId,
      studentName: users.name,
      courseId: courses.id,
      courseTitle: courses.title,
      courseLevel: courses.level,
      instructorId: courses.instructorId,
      lessonCount: sql<number>`(select count(*)::int from ${lessons} l where l.course_id = ${courses.id})`,
      totalSeconds: sql<number>`(select coalesce(sum(l.duration_seconds), 0)::int from ${lessons} l where l.course_id = ${courses.id})`,
    })
    .from(certificates)
    .innerJoin(users, eq(users.id, certificates.userId))
    .innerJoin(courses, eq(courses.id, certificates.courseId))
    .where(eq(certificates.id, id))
    .limit(1);
  if (!row) return null;
  const [instructor] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.instructorId)).limit(1);
  return { ...row, instructorName: instructor?.name ?? "" };
}

export async function getCertificatesForUser(userId: string) {
  const rows = await db
    .select({ id: certificates.id, courseId: certificates.courseId })
    .from(certificates)
    .where(eq(certificates.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.courseId, r.id])) as Record<string, string>;
}

/** Every quiz in a course, grouped by lesson, with answers (for the instructor's editor). */
export async function getQuizzesForCourse(courseId: string) {
  const rows = await db
    .select({
      lessonId: quizQuestions.lessonId,
      prompt: quizQuestions.prompt,
      options: quizQuestions.options,
      correctIndex: quizQuestions.correctIndex,
      explanation: quizQuestions.explanation,
    })
    .from(quizQuestions)
    .innerJoin(lessons, eq(lessons.id, quizQuestions.lessonId))
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(quizQuestions.lessonId), asc(quizQuestions.position));
  const byLesson: Record<string, { prompt: string; options: string[]; correctIndex: number; explanation: string }[]> = {};
  for (const { lessonId, ...q } of rows) (byLesson[lessonId] ??= []).push(q);
  return byLesson;
}
