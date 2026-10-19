"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { plainText } from "@/lib/format";
import { notifyCourse } from "@/lib/notifications";
import { echo, type FormState } from "./types";

const { announcements, courses } = schema;

const AnnouncementSchema = z.object({
  title: z.string().trim().min(3, "Give the announcement a title.").max(140),
  body: z.string().trim().max(10000, "Keep it under 10,000 characters.").default(""),
});

export async function postAnnouncementAction(courseId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("instructor");
  if (!z.uuid().safeParse(courseId).success) return { error: "Course not found." };
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course || (course.instructorId !== user.id && user.role !== "admin")) return { error: "Course not found." };
  const parsed = AnnouncementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };

  await db.insert(announcements).values({ courseId, authorId: user.id, ...parsed.data });
  await notifyCourse(courseId, {
    kind: "announcement",
    title: `${course.title}: ${parsed.data.title}`,
    body: plainText(parsed.data.body),
    href: `/courses/${courseId}#announcements`,
  });
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/learn/${courseId}`, "layout");
  return { ok: true, message: "Announcement sent to every enrolled student." };
}

export async function deleteAnnouncementAction(courseId: string, announcementId: string): Promise<FormState> {
  const user = await requireRole("instructor");
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(announcementId).success) return { error: "Not found." };
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course || (course.instructorId !== user.id && user.role !== "admin")) return { error: "Course not found." };
  await db.delete(announcements).where(and(eq(announcements.id, announcementId), eq(announcements.courseId, courseId)));
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/learn/${courseId}`, "layout");
  return { ok: true, message: "Announcement deleted." };
}
