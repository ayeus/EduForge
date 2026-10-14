"use server";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, type CurrentUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { deleteFile, keyBelongsTo } from "@/lib/storage";
import { echo, type FormState } from "./types";

const { courses, lessons } = schema;

async function ownCourse(user: CurrentUser, courseId: string) {
  const parsedId = z.uuid().safeParse(courseId);
  if (!parsedId.success) return null;
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return null;
  if (course.instructorId !== user.id && user.role !== "admin") return null;
  return course;
}

function touch(courseId: string) {
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/learn/${courseId}`, "layout");
  revalidatePath("/studio");
  revalidatePath("/courses");
}

const CourseSchema = z.object({
  title: z.string().trim().min(3, "Give the course a title (3+ characters).").max(140),
  summary: z.string().trim().max(280, "Keep the summary under 280 characters.").default(""),
  description: z.string().trim().max(20000).default(""),
  category: z.string().trim().min(2, "Pick a category.").max(60),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  coverKey: z.string().max(500).optional(),
});

export async function createCourseAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("instructor");
  const parsed = CourseSchema.omit({ coverKey: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  const [course] = await db
    .insert(courses)
    .values({ ...parsed.data, instructorId: user.id })
    .returning({ id: courses.id });
  revalidatePath("/studio");
  redirect(`/studio/courses/${course.id}`);
}

export async function updateCourseAction(courseId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("instructor");
  const course = await ownCourse(user, courseId);
  if (!course) return { error: "Course not found." };
  const raw = Object.fromEntries(formData);
  const parsed = CourseSchema.safeParse({ ...raw, coverKey: raw.coverKey || undefined });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  const { coverKey, ...rest } = parsed.data;
  if (coverKey && !keyBelongsTo(coverKey, courseId)) return { error: "Invalid cover upload." };
  if (coverKey && coverKey !== course.coverKey) await deleteFile(course.coverKey);
  await db
    .update(courses)
    .set({ ...rest, ...(coverKey ? { coverKey } : {}) })
    .where(eq(courses.id, courseId));
  touch(courseId);
  return { ok: true, message: "Course details saved." };
}

export async function setCourseStatusAction(courseId: string, status: "draft" | "published"): Promise<FormState> {
  const user = await requireRole("instructor");
  const course = await ownCourse(user, courseId);
  if (!course) return { error: "Course not found." };
  if (status === "published") {
    const [{ n }] = await db.select({ n: count() }).from(lessons).where(eq(lessons.courseId, courseId));
    if (n === 0) return { error: "Add at least one lesson before publishing." };
  }
  await db
    .update(courses)
    .set({ status, publishedAt: status === "published" ? (course.publishedAt ?? new Date()) : course.publishedAt })
    .where(eq(courses.id, courseId));
  touch(courseId);
  return { ok: true, message: status === "published" ? "Course published." : "Course moved to drafts." };
}

export async function deleteCourseAction(courseId: string) {
  const user = await requireRole("instructor");
  const course = await ownCourse(user, courseId);
  if (!course) return { error: "Course not found." };
  const files = await db
    .select({ v: lessons.videoKey, a: lessons.attachmentKey })
    .from(lessons)
    .where(eq(lessons.courseId, courseId));
  await db.delete(courses).where(eq(courses.id, courseId));
  await Promise.all([course.coverKey, ...files.flatMap((f) => [f.v, f.a])].map((k) => deleteFile(k)));
  revalidatePath("/studio");
  revalidatePath("/courses");
  redirect("/studio");
}

/* ───────────────────────────── Lessons ───────────────────────────── */

const LessonSchema = z.object({
  title: z.string().trim().min(2, "Give the lesson a title.").max(140),
  content: z.string().trim().max(50000).default(""),
  videoKey: z.string().max(500).optional(),
  attachmentKey: z.string().max(500).optional(),
  attachmentName: z.string().max(255).optional(),
  durationSeconds: z.coerce.number().int().min(0).max(60 * 60 * 24).optional(),
  removeVideo: z.literal("on").optional(),
  removeAttachment: z.literal("on").optional(),
});

function parseLesson(formData: FormData) {
  const raw = Object.fromEntries(formData);
  for (const k of ["videoKey", "attachmentKey", "attachmentName", "durationSeconds"]) {
    if (raw[k] === "") delete raw[k];
  }
  return LessonSchema.safeParse(raw);
}

export async function saveLessonAction(
  courseId: string,
  lessonId: string | null,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("instructor");
  const course = await ownCourse(user, courseId);
  if (!course) return { error: "Course not found." };
  const parsed = parseLesson(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  const d = parsed.data;
  for (const key of [d.videoKey, d.attachmentKey]) {
    if (key && !keyBelongsTo(key, courseId)) return { error: "Invalid upload." };
  }

  if (!lessonId) {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${lessons.position}), -1) + 1` })
      .from(lessons)
      .where(eq(lessons.courseId, courseId));
    await db.insert(lessons).values({
      courseId,
      title: d.title,
      content: d.content,
      videoKey: d.videoKey ?? null,
      attachmentKey: d.attachmentKey ?? null,
      attachmentName: d.attachmentKey ? (d.attachmentName ?? "Attachment") : null,
      durationSeconds: d.durationSeconds ?? null,
      position: next,
    });
    touch(courseId);
    return { ok: true, message: "Lesson added." };
  }

  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
    .limit(1);
  if (!lesson) return { error: "Lesson not found." };

  const patch: Partial<typeof lessons.$inferInsert> = { title: d.title, content: d.content };
  if (d.videoKey && d.videoKey !== lesson.videoKey) {
    await deleteFile(lesson.videoKey);
    patch.videoKey = d.videoKey;
    patch.durationSeconds = d.durationSeconds ?? null;
  } else if (d.removeVideo) {
    await deleteFile(lesson.videoKey);
    patch.videoKey = null;
    patch.durationSeconds = null;
  }
  if (d.attachmentKey && d.attachmentKey !== lesson.attachmentKey) {
    await deleteFile(lesson.attachmentKey);
    patch.attachmentKey = d.attachmentKey;
    patch.attachmentName = d.attachmentName ?? "Attachment";
  } else if (d.removeAttachment) {
    await deleteFile(lesson.attachmentKey);
    patch.attachmentKey = null;
    patch.attachmentName = null;
  }
  await db.update(lessons).set(patch).where(eq(lessons.id, lessonId));
  touch(courseId);
  return { ok: true, message: "Lesson saved." };
}

export async function deleteLessonAction(courseId: string, lessonId: string): Promise<FormState> {
  const user = await requireRole("instructor");
  const course = await ownCourse(user, courseId);
  if (!course) return { error: "Course not found." };
  const [lesson] = await db
    .delete(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
    .returning();
  if (!lesson) return { error: "Lesson not found." };
  await Promise.all([deleteFile(lesson.videoKey), deleteFile(lesson.attachmentKey)]);
  const [{ n }] = await db.select({ n: count() }).from(lessons).where(eq(lessons.courseId, courseId));
  if (n === 0 && course.status === "published") {
    await db.update(courses).set({ status: "draft" }).where(eq(courses.id, courseId));
  }
  touch(courseId);
  return { ok: true, message: n === 0 && course.status === "published" ? "Lesson deleted. The course is back in drafts because it has no lessons." : "Lesson deleted." };
}

export async function moveLessonAction(courseId: string, lessonId: string, direction: -1 | 1): Promise<FormState> {
  const user = await requireRole("instructor");
  const course = await ownCourse(user, courseId);
  if (!course) return { error: "Course not found." };
  const rows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.position), asc(lessons.createdAt));
  const i = rows.findIndex((r) => r.id === lessonId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length) return null;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.transaction(async (tx) => {
    for (const [position, row] of rows.entries()) {
      await tx.update(lessons).set({ position }).where(eq(lessons.id, row.id));
    }
  });
  touch(courseId);
  return { ok: true };
}
