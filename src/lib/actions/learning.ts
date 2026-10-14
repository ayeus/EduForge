"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";

const { enrollments, courses, lessons, lessonProgress } = schema;

export async function enrollAction(courseId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(courseId).success) redirect("/courses");
  const [course] = await db
    .select({ id: courses.id, status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course || course.status !== "published") redirect("/courses");
  await db.insert(enrollments).values({ userId: user.id, courseId }).onConflictDoNothing();
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseId}`);
  redirect(`/learn/${courseId}`);
}

export async function unenrollAction(courseId: string) {
  const user = await requireUser();
  await db.delete(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId)));
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseId}`);
  redirect("/dashboard");
}

/** Confirms the lesson exists and the user is enrolled in its course. */
async function lessonAccess(userId: string, lessonId: string) {
  if (!z.uuid().safeParse(lessonId).success) return null;
  const [row] = await db
    .select({ courseId: lessons.courseId })
    .from(lessons)
    .innerJoin(enrollments, and(eq(enrollments.courseId, lessons.courseId), eq(enrollments.userId, userId)))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return row ?? null;
}

export async function setLessonCompleteAction(lessonId: string, completed: boolean) {
  const user = await requireUser();
  const access = await lessonAccess(user.id, lessonId);
  if (!access) return { error: "Enroll in this course to track progress." };
  const completedAt = completed ? new Date() : null;
  await db
    .insert(lessonProgress)
    .values({ userId: user.id, lessonId, completed, completedAt })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { completed, completedAt },
    });
  await db
    .update(enrollments)
    .set({ lastActiveAt: new Date(), lastLessonId: lessonId })
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, access.courseId)));
  revalidatePath(`/learn/${access.courseId}`, "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Resume point. Called periodically by the player; deliberately does not revalidate. */
export async function savePositionAction(lessonId: string, seconds: number) {
  const user = await requireUser();
  const access = await lessonAccess(user.id, lessonId);
  if (!access) return;
  const positionSeconds = Math.max(0, Math.min(Math.floor(seconds), 60 * 60 * 24));
  await db
    .insert(lessonProgress)
    .values({ userId: user.id, lessonId, positionSeconds })
    .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: { positionSeconds } });
  await db
    .update(enrollments)
    .set({ lastActiveAt: new Date(), lastLessonId: lessonId })
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, access.courseId)));
}
