import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";

const { enrollments, lessons, lessonProgress, certificates, courses } = schema;

/** Confirms the lesson exists and the user is enrolled in its course. */
export async function lessonAccess(userId: string, lessonId: string) {
  if (!z.uuid().safeParse(lessonId).success) return null;
  const [row] = await db
    .select({ courseId: lessons.courseId })
    .from(lessons)
    .innerJoin(enrollments, and(eq(enrollments.courseId, lessons.courseId), eq(enrollments.userId, userId)))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return row ?? null;
}

export async function setLessonCompleted(userId: string, lessonId: string, courseId: string, completed: boolean) {
  const completedAt = completed ? new Date() : null;
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, completed, completedAt })
    .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: { completed, completedAt } });
  await db
    .update(enrollments)
    .set({ lastActiveAt: new Date(), lastLessonId: lessonId })
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
  return completed ? issueCertificateIfComplete(userId, courseId) : null;
}

/** Issues the course certificate the first time every lesson is complete. Returns its id when newly issued. */
export async function issueCertificateIfComplete(userId: string, courseId: string) {
  const [{ total, done }] = await db
    .select({
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${lessonProgress.completed})::int`,
    })
    .from(lessons)
    .leftJoin(lessonProgress, and(eq(lessonProgress.lessonId, lessons.id), eq(lessonProgress.userId, userId)))
    .where(eq(lessons.courseId, courseId));
  if (!total || done < total) return null;
  const [cert] = await db
    .insert(certificates)
    .values({ userId, courseId })
    .onConflictDoNothing()
    .returning({ id: certificates.id });
  if (!cert) return null;
  const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId)).limit(1);
  await notifyUser({
    userId,
    kind: "certificate",
    title: "You earned a certificate",
    body: `You completed every lesson in ${course?.title ?? "your course"}.`,
    href: `/certificates/${cert.id}`,
  });
  return cert.id;
}
