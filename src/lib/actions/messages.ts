"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { authorizeThread } from "@/lib/data/messages";

const Body = z.string().trim().min(1, "Write a message first.").max(4000, "Keep messages under 4,000 characters.");

export async function sendMessageAction(courseId: string, studentId: string, body: string) {
  const user = await requireUser();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(studentId).success) {
    return { error: "Conversation not found." };
  }
  const thread = await authorizeThread(user, courseId, studentId);
  if (!thread) return { error: "You can't post in this conversation." };
  await db.insert(schema.messages).values({ courseId, studentId, senderId: user.id, body: parsed.data });
  revalidatePath("/studio/inbox");
  return { ok: true };
}

export async function markThreadReadAction(courseId: string, studentId: string) {
  const user = await requireUser();
  const thread = await authorizeThread(user, courseId, studentId);
  if (!thread) return;
  const updated = await db
    .update(schema.messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.messages.courseId, courseId),
        eq(schema.messages.studentId, studentId),
        ne(schema.messages.senderId, user.id),
        isNull(schema.messages.readAt),
      ),
    )
    .returning({ id: schema.messages.id });
  if (updated.length) {
    revalidatePath("/studio/inbox", "layout");
    revalidatePath("/studio");
    revalidatePath("/dashboard");
  }
}
