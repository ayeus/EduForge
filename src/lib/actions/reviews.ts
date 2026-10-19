"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { echo, type FormState } from "./types";

const { reviews, enrollments, courses } = schema;

const ReviewSchema = z.object({
  rating: z.coerce.number({ error: "Pick a star rating." }).int().min(1, "Pick a star rating.").max(5),
  body: z.string().trim().max(2000, "Keep reviews under 2,000 characters.").default(""),
});

function touch(courseId: string) {
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath(`/studio/courses/${courseId}`);
}

export async function saveReviewAction(courseId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(courseId).success) return { error: "Course not found." };
  const [row] = await db
    .select({ title: courses.title, instructorId: courses.instructorId })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, user.id)))
    .limit(1);
  if (!row) return { error: "Enroll in this course to review it." };
  const parsed = ReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };

  const [existing] = await db
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.courseId, courseId), eq(reviews.userId, user.id)))
    .limit(1);
  await db
    .insert(reviews)
    .values({ userId: user.id, courseId, ...parsed.data })
    .onConflictDoUpdate({ target: [reviews.userId, reviews.courseId], set: { ...parsed.data, updatedAt: new Date() } });

  if (!existing) {
    await notifyUser({
      userId: row.instructorId,
      kind: "review",
      title: `${user.name} rated ${row.title} ${"★".repeat(parsed.data.rating)}`,
      body: parsed.data.body,
      href: `/courses/${courseId}#reviews`,
    });
  }
  touch(courseId);
  return { ok: true, message: existing ? "Review updated." : "Thanks for the review." };
}

export async function deleteReviewAction(courseId: string): Promise<FormState> {
  const user = await requireUser();
  if (!z.uuid().safeParse(courseId).success) return { error: "Course not found." };
  await db.delete(reviews).where(and(eq(reviews.courseId, courseId), eq(reviews.userId, user.id)));
  touch(courseId);
  return { ok: true, message: "Review removed." };
}
