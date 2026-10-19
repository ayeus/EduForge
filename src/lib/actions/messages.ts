"use server";

import { and, count, eq, gt, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { authorizeThread, threadKey } from "@/lib/data/messages";
import { markNotificationsRead, notifyUser } from "@/lib/notifications";
import { publish, signal, topics } from "@/lib/realtime/server";

const Body = z.string().trim().min(1, "Write a message first.").max(4000, "Keep messages under 4,000 characters.");
const Ids = z.object({ courseId: z.uuid(), studentId: z.uuid() });

async function loadThread(courseId: string, studentId: string) {
  const user = await requireUser();
  if (!Ids.safeParse({ courseId, studentId }).success) return null;
  const thread = await authorizeThread(user, courseId, studentId);
  return thread ? { user, thread } : null;
}

export async function sendMessageAction(courseId: string, studentId: string, body: string) {
  const parsed = Body.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await loadThread(courseId, studentId);
  if (!ctx) return { error: "You can't post in this conversation." };
  const { user, thread } = ctx;

  const [recent] = await db
    .select({ n: count() })
    .from(schema.messages)
    .where(and(eq(schema.messages.senderId, user.id), gt(schema.messages.createdAt, new Date(Date.now() - 60_000))));
  if (recent.n >= 20) return { error: "You're sending messages too quickly. Wait a moment and try again." };

  const [row] = await db
    .insert(schema.messages)
    .values({ courseId, studentId, senderId: user.id, body: parsed.data })
    .returning();
  const message = {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    readAt: null,
    senderId: user.id,
    senderName: user.name,
  };

  const instructorId = thread.course.instructorId;
  const participants = [...new Set([studentId, instructorId])];
  await publish(
    ...participants.map((id) => ({ topic: topics.user(id), type: "message", data: { courseId, studentId, message } })),
  );

  const recipientId = user.id === studentId ? instructorId : studentId;
  if (recipientId !== user.id) {
    await notifyUser({
      userId: recipientId,
      kind: "message",
      title: `${user.name} · ${thread.course.title}`,
      body: parsed.data,
      href: recipientId === studentId ? `/messages/${courseId}` : `/studio/inbox/${courseId}/${studentId}`,
      groupKey: threadKey(courseId, studentId),
    });
  }
  revalidatePath("/studio/inbox", "layout");
  revalidatePath("/messages", "layout");
  return { ok: true as const, message };
}

/** Tells the other person "…is typing". Not stored. */
export async function typingAction(courseId: string, studentId: string) {
  const ctx = await loadThread(courseId, studentId);
  if (!ctx) return;
  const peerId = ctx.user.id === studentId ? ctx.thread.course.instructorId : studentId;
  await signal(topics.user(peerId), "typing", { courseId, studentId, userId: ctx.user.id, name: ctx.user.name });
}

export async function markThreadReadAction(courseId: string, studentId: string) {
  const ctx = await loadThread(courseId, studentId);
  if (!ctx) return;
  const { user, thread } = ctx;
  const readAt = new Date();
  const updated = await db
    .update(schema.messages)
    .set({ readAt })
    .where(
      and(
        eq(schema.messages.courseId, courseId),
        eq(schema.messages.studentId, studentId),
        ne(schema.messages.senderId, user.id),
        isNull(schema.messages.readAt),
      ),
    )
    .returning({ id: schema.messages.id });
  await markNotificationsRead(user.id, { groupKey: threadKey(courseId, studentId) });
  if (!updated.length) return;

  const participants = [...new Set([studentId, thread.course.instructorId])];
  await publish(
    ...participants.map((id) => ({
      topic: topics.user(id),
      type: "thread.read",
      data: { courseId, studentId, readerId: user.id, readAt: readAt.toISOString() },
    })),
  );
  revalidatePath("/studio/inbox", "layout");
  revalidatePath("/messages", "layout");
  revalidatePath("/studio");
  revalidatePath("/dashboard");
}
