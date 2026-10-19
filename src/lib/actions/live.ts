"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser, type CurrentUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { REACTIONS, type Reaction } from "@/lib/live/constants";
import { createLiveStream, mux, muxConfigured } from "@/lib/live/mux";
import { endSession, getLiveAccess } from "@/lib/live/sessions";
import { notifyCourse } from "@/lib/notifications";
import { publish, signal, topics } from "@/lib/realtime/server";
import { echo, type FormState } from "./types";

const { liveSessions, liveChatMessages, courses } = schema;

const SessionSchema = z.object({
  title: z.string().trim().min(3, "Give the class a title (3+ characters).").max(140),
  description: z.string().trim().max(5000).default(""),
  scheduledFor: z.coerce
    .date({ error: "Pick a date and time." })
    .refine((d) => d.getTime() > Date.now() - 60 * 60_000, "Pick a time that hasn't passed.")
    .refine((d) => d.getTime() < Date.now() + 366 * 86_400_000, "Pick a time within the next year."),
});

async function hostSession(user: CurrentUser, sessionId: string) {
  if (!z.uuid().safeParse(sessionId).success) return null;
  const access = await getLiveAccess(user, sessionId);
  return access?.isHost ? access : null;
}

function touchLive(courseId: string, sessionId?: string) {
  revalidatePath("/live");
  revalidatePath("/studio");
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  if (sessionId) {
    revalidatePath(`/live/${sessionId}`);
    revalidatePath(`/studio/live/${sessionId}`);
  }
}

/** Create the Mux stream for a session. Failures are reported but never block scheduling. */
async function attachStream(sessionId: string) {
  if (!muxConfigured()) return { error: "Live streaming isn't connected yet." };
  try {
    const stream = await createLiveStream(sessionId);
    await db
      .update(liveSessions)
      .set({ muxStreamId: stream.id, muxStreamKey: stream.streamKey, muxPlaybackId: stream.playbackId, signedPlayback: stream.signed })
      .where(eq(liveSessions.id, sessionId));
    return { ok: true };
  } catch (err) {
    console.error("[live] could not create Mux stream", err);
    return { error: "Mux didn't accept the request. Check the Mux credentials and try again." };
  }
}

export async function scheduleLiveAction(courseId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("instructor");
  if (!z.uuid().safeParse(courseId).success) return { error: "Course not found." };
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course || (course.instructorId !== user.id && user.role !== "admin")) return { error: "Course not found." };

  const parsed = SessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };

  const [session] = await db
    .insert(liveSessions)
    .values({ courseId, ...parsed.data })
    .returning({ id: liveSessions.id });
  await attachStream(session.id);

  if (course.status === "published") {
    await notifyCourse(courseId, {
      kind: "live",
      title: `Live class scheduled: ${parsed.data.title}`,
      body: course.title,
      href: `/live/${session.id}`,
    });
  }
  touchLive(courseId);
  redirect(`/studio/live/${session.id}`);
}

export async function updateLiveAction(sessionId: string, _: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("instructor");
  const access = await hostSession(user, sessionId);
  if (!access) return { error: "Live class not found." };
  if (access.session.status === "ended") return { error: "This class has ended and can't be edited." };
  const parsed = SessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  await db.update(liveSessions).set(parsed.data).where(eq(liveSessions.id, sessionId));
  await publish({ topic: topics.live(sessionId), type: "live.updated", data: { sessionId } });
  touchLive(access.course.id, sessionId);
  return { ok: true, message: "Class details saved." };
}

export async function deleteLiveAction(sessionId: string) {
  const user = await requireRole("instructor");
  const access = await hostSession(user, sessionId);
  if (!access) return { error: "Live class not found." };
  if (access.session.status === "live") return { error: "End the class before deleting it." };
  if (access.session.muxStreamId && muxConfigured()) {
    await mux()
      .video.liveStreams.delete(access.session.muxStreamId)
      .catch((err) => console.error("[live] could not delete stream", err));
  }
  await db.delete(liveSessions).where(eq(liveSessions.id, sessionId));
  touchLive(access.course.id);
  redirect(`/studio/courses/${access.course.id}?tab=live`);
}

export async function createStreamAction(sessionId: string): Promise<FormState> {
  const user = await requireRole("instructor");
  const access = await hostSession(user, sessionId);
  if (!access) return { error: "Live class not found." };
  if (access.session.muxStreamId) return { ok: true };
  const res = await attachStream(sessionId);
  touchLive(access.course.id, sessionId);
  return res;
}

export async function resetStreamKeyAction(sessionId: string): Promise<FormState> {
  const user = await requireRole("instructor");
  const access = await hostSession(user, sessionId);
  if (!access?.session.muxStreamId) return { error: "Live class not found." };
  if (access.session.status === "live") return { error: "You can't reset the key while you're live." };
  try {
    const stream = await mux().video.liveStreams.resetStreamKey(access.session.muxStreamId);
    await db.update(liveSessions).set({ muxStreamKey: stream.stream_key }).where(eq(liveSessions.id, sessionId));
  } catch (err) {
    console.error("[live] reset key failed", err);
    return { error: "Mux couldn't reset the key. Try again in a moment." };
  }
  revalidatePath(`/studio/live/${sessionId}`);
  return { ok: true, message: "New stream key issued. Update it in your streaming software." };
}

export async function endLiveAction(sessionId: string): Promise<FormState> {
  const user = await requireRole("instructor");
  const access = await hostSession(user, sessionId);
  if (!access) return { error: "Live class not found." };
  if (access.session.status === "ended") return { ok: true };
  await endSession(access.session);
  touchLive(access.course.id, sessionId);
  return { ok: true, message: "Class ended. The recording will be ready to watch shortly." };
}

/* ───────────────────────────── Live chat ───────────────────────────── */

const ChatBody = z.string().trim().min(1, "Write something first.").max(500, "Keep chat messages under 500 characters.");

export async function sendLiveChatAction(sessionId: string, body: string) {
  const user = await requireUser();
  const parsed = ChatBody.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!z.uuid().safeParse(sessionId).success) return { error: "Live class not found." };
  const access = await getLiveAccess(user, sessionId);
  if (!access) return { error: "Live class not found." };
  if (access.session.status === "ended") return { error: "Chat is closed because the class has ended." };

  // One message per second per person keeps the chat readable.
  const [last] = await db
    .select({ at: liveChatMessages.createdAt })
    .from(liveChatMessages)
    .where(and(eq(liveChatMessages.sessionId, sessionId), eq(liveChatMessages.userId, user.id)))
    .orderBy(desc(liveChatMessages.createdAt))
    .limit(1);
  if (last && Date.now() - last.at.getTime() < 1000) return { error: "You're sending messages too quickly." };

  const [row] = await db
    .insert(liveChatMessages)
    .values({ sessionId, userId: user.id, body: parsed.data })
    .returning();
  const message = {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    userId: user.id,
    name: user.name,
    host: access.isHost,
  };
  await publish({ topic: topics.live(sessionId), type: "live.chat", data: { sessionId, message } });
  return { ok: true as const, message };
}

export async function deleteLiveChatAction(sessionId: string, messageId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(sessionId).success || !z.uuid().safeParse(messageId).success) return;
  const access = await getLiveAccess(user, sessionId);
  if (!access) return;
  const [row] = await db
    .select({ userId: liveChatMessages.userId })
    .from(liveChatMessages)
    .where(and(eq(liveChatMessages.id, messageId), eq(liveChatMessages.sessionId, sessionId)))
    .limit(1);
  if (!row || (!access.isHost && row.userId !== user.id)) return;
  await db.delete(liveChatMessages).where(eq(liveChatMessages.id, messageId));
  await publish({ topic: topics.live(sessionId), type: "live.chat.deleted", data: { sessionId, id: messageId } });
}

export async function pinNoteAction(sessionId: string, text: string | null) {
  const user = await requireRole("instructor");
  const access = await hostSession(user, sessionId);
  if (!access) return { error: "Live class not found." };
  const note = text?.trim().slice(0, 280) || null;
  await db.update(liveSessions).set({ pinnedNote: note }).where(eq(liveSessions.id, sessionId));
  await publish({ topic: topics.live(sessionId), type: "live.pinned", data: { sessionId, note } });
  return { ok: true };
}

const recentReactions = new Map<string, number>();

/** Floating reactions over the stream. Ephemeral and lightly rate limited per server instance. */
export async function reactAction(sessionId: string, emoji: string) {
  const user = await requireUser();
  if (!REACTIONS.includes(emoji as Reaction)) return;
  if (!z.uuid().safeParse(sessionId).success) return;
  const k = `${user.id}:${sessionId}`;
  const lastAt = recentReactions.get(k) ?? 0;
  if (Date.now() - lastAt < 700) return;
  recentReactions.set(k, Date.now());
  if (recentReactions.size > 5000) recentReactions.clear();
  const access = await getLiveAccess(user, sessionId);
  if (!access || access.session.status !== "live") return;
  await signal(topics.live(sessionId), "live.reaction", { sessionId, emoji, by: user.id });
}
