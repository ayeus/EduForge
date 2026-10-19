import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { LiveSession } from "@/lib/db/schema";
import type { CurrentUser } from "@/lib/auth/dal";
import { notifyCourse } from "@/lib/notifications";
import { publish, signal, topics } from "@/lib/realtime/server";
import { mux, muxConfigured } from "./mux";

const { liveSessions, courses, enrollments, users, liveChatMessages, livePresence } = schema;

/**
 * Loads a session with its course and decides what the viewer may do.
 * Hosts are the course instructor (or an admin); students must be enrolled.
 */
export async function getLiveAccess(user: CurrentUser, sessionId: string) {
  const [row] = await db
    .select({
      session: liveSessions,
      courseId: courses.id,
      courseTitle: courses.title,
      instructorId: courses.instructorId,
      instructorName: users.name,
    })
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(eq(liveSessions.id, sessionId))
    .limit(1);
  if (!row) return null;
  const isHost = row.instructorId === user.id || user.role === "admin";
  if (!isHost) {
    const [e] = await db
      .select({ c: enrollments.courseId })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, row.courseId), eq(enrollments.userId, user.id)))
      .limit(1);
    if (!e) return null;
  }
  return {
    session: row.session,
    course: { id: row.courseId, title: row.courseTitle, instructorId: row.instructorId, instructorName: row.instructorName },
    isHost,
  };
}

async function broadcastStatus(s: LiveSession) {
  const data = { sessionId: s.id, courseId: s.courseId, status: s.status, title: s.title, startedAt: s.startedAt, endedAt: s.endedAt };
  await publish(
    { topic: topics.live(s.id), type: "live.status", data },
    { topic: topics.course(s.courseId), type: "live.status", data },
  );
}

export async function markLive(s: LiveSession) {
  const [updated] = await db
    .update(liveSessions)
    .set({ status: "live", startedAt: new Date() })
    .where(and(eq(liveSessions.id, s.id), eq(liveSessions.status, "scheduled")))
    .returning();
  if (!updated) return s;
  await broadcastStatus(updated);
  await notifyCourse(updated.courseId, {
    kind: "live",
    title: `Live now: ${updated.title}`,
    body: "Your instructor just went live. Join the class.",
    href: `/live/${updated.id}`,
  });
  return updated;
}

export async function markEnded(s: LiveSession) {
  const [updated] = await db
    .update(liveSessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(and(eq(liveSessions.id, s.id), inArray(liveSessions.status, ["scheduled", "live"])))
    .returning();
  if (!updated) return s;
  await db.delete(livePresence).where(eq(livePresence.sessionId, s.id));
  await broadcastStatus(updated);
  return updated;
}

/** Look up the recording Mux made of the broadcast and store its playback id. */
async function attachReplay(s: LiveSession, recentAssetIds: string[] | undefined) {
  if (s.replayPlaybackId || !recentAssetIds?.length || !s.startedAt) return s;
  const assetId = recentAssetIds.at(-1)!;
  const asset = await mux().video.assets.retrieve(assetId);
  const playbackId = asset.playback_ids?.[0]?.id;
  if (!playbackId) return s;
  const [updated] = await db
    .update(liveSessions)
    .set({ replayAssetId: assetId, replayPlaybackId: playbackId })
    .where(eq(liveSessions.id, s.id))
    .returning();
  await publish({ topic: topics.live(s.id), type: "live.replay", data: { sessionId: s.id } });
  return updated;
}

export type EncoderState = "idle" | "active" | "disabled" | "unknown";

/**
 * Pull the stream state from Mux and move the session along: scheduled → live when the
 * encoder starts sending video, live → ended when it stops (after Mux's reconnect window).
 * Works without webhooks; webhooks just call this sooner.
 */
export async function syncWithMux(s: LiveSession, { force = false } = {}): Promise<{ session: LiveSession; encoder: EncoderState }> {
  if (!s.muxStreamId || !muxConfigured()) return { session: s, encoder: "unknown" };
  if (s.status === "ended" && s.replayPlaybackId) return { session: s, encoder: "disabled" };
  if (!force && s.syncedAt && Date.now() - s.syncedAt.getTime() < 8000) return { session: s, encoder: "unknown" };

  await db.update(liveSessions).set({ syncedAt: new Date() }).where(eq(liveSessions.id, s.id));
  const stream = await mux().video.liveStreams.retrieve(s.muxStreamId);
  let session = s;
  if (stream.status === "active" && session.status === "scheduled") {
    session = await markLive(session);
  } else if (stream.status !== "active" && session.status === "live") {
    session = await markEnded(session);
  }
  if (session.status === "ended") session = await attachReplay(session, stream.recent_asset_ids);
  return { session, encoder: stream.status };
}

/** Host ends the class: stop accepting video right away and finalize the recording. */
export async function endSession(s: LiveSession) {
  if (s.muxStreamId && muxConfigured()) {
    try {
      await mux().video.liveStreams.disable(s.muxStreamId);
    } catch (err) {
      console.error("[live] could not disable stream", err);
    }
  }
  const ended = await markEnded(s);
  if (s.muxStreamId && muxConfigured()) {
    try {
      const stream = await mux().video.liveStreams.retrieve(s.muxStreamId);
      return await attachReplay(ended, stream.recent_asset_ids);
    } catch {}
  }
  return ended;
}

/* ───────────────────────────── Listings ───────────────────────────── */

const sessionCols = {
  id: liveSessions.id,
  title: liveSessions.title,
  description: liveSessions.description,
  scheduledFor: liveSessions.scheduledFor,
  status: liveSessions.status,
  startedAt: liveSessions.startedAt,
  endedAt: liveSessions.endedAt,
  hasReplay: sql<boolean>`${liveSessions.replayPlaybackId} is not null`,
  courseId: courses.id,
  courseTitle: courses.title,
  instructorName: users.name,
};

export type LiveListing = Awaited<ReturnType<typeof listLiveForCourse>>[number];

/** Live first, then upcoming soonest-first, then past newest-first. */
const ordering = [
  sql`case ${liveSessions.status} when 'live' then 0 when 'scheduled' then 1 else 2 end`,
  sql`case when ${liveSessions.status} = 'ended' then null else ${liveSessions.scheduledFor} end asc nulls last`,
  desc(liveSessions.scheduledFor),
];

export async function listLiveForCourse(courseId: string) {
  return db
    .select(sessionCols)
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(eq(liveSessions.courseId, courseId))
    .orderBy(...ordering)
    .limit(50);
}

/** Live, upcoming and recent replays across a student's enrolled courses. */
export async function listLiveForStudent(userId: string) {
  return db
    .select(sessionCols)
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .innerJoin(users, eq(users.id, courses.instructorId))
    .innerJoin(enrollments, and(eq(enrollments.courseId, courses.id), eq(enrollments.userId, userId)))
    .where(
      or(
        eq(liveSessions.status, "live"),
        and(eq(liveSessions.status, "scheduled"), gt(liveSessions.scheduledFor, sql`now() - interval '6 hours'`)),
        and(eq(liveSessions.status, "ended"), isNotNull(liveSessions.replayPlaybackId), gt(liveSessions.endedAt, sql`now() - interval '60 days'`)),
      ),
    )
    .orderBy(...ordering)
    .limit(40);
}

export async function listLiveForInstructor(user: CurrentUser) {
  return db
    .select(sessionCols)
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(user.role === "admin" ? undefined : eq(courses.instructorId, user.id))
    .orderBy(...ordering)
    .limit(60);
}

/** The session currently live for a course, if any (for "live now" banners). */
export async function getLiveNow(courseId: string) {
  const [row] = await db
    .select({ id: liveSessions.id, title: liveSessions.title })
    .from(liveSessions)
    .where(and(eq(liveSessions.courseId, courseId), eq(liveSessions.status, "live")))
    .orderBy(asc(liveSessions.startedAt))
    .limit(1);
  return row ?? null;
}

/* ───────────────────────────── Chat & presence ───────────────────────────── */

export type LiveChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  name: string;
  host: boolean;
};

export async function getLiveChat(sessionId: string, instructorId: string, limit = 150): Promise<LiveChatMessage[]> {
  const rows = await db
    .select({
      id: liveChatMessages.id,
      body: liveChatMessages.body,
      createdAt: liveChatMessages.createdAt,
      userId: liveChatMessages.userId,
      name: users.name,
      role: users.role,
    })
    .from(liveChatMessages)
    .innerJoin(users, eq(users.id, liveChatMessages.userId))
    .where(eq(liveChatMessages.sessionId, sessionId))
    .orderBy(desc(liveChatMessages.createdAt))
    .limit(limit);
  return rows.reverse().map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    userId: r.userId,
    name: r.name,
    host: r.userId === instructorId || r.role === "admin",
  }));
}

const VIEWER_WINDOW = sql`now() - interval '45 seconds'`;

export async function viewerCount(sessionId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(livePresence)
    .where(and(eq(livePresence.sessionId, sessionId), gt(livePresence.lastSeenAt, VIEWER_WINDOW)));
  return n;
}

export async function touchPresence(sessionId: string, userId: string) {
  await db
    .insert(livePresence)
    .values({ sessionId, userId })
    .onConflictDoUpdate({ target: [livePresence.sessionId, livePresence.userId], set: { lastSeenAt: new Date() } });
}

export async function leavePresence(sessionId: string, userId: string) {
  await db.delete(livePresence).where(and(eq(livePresence.sessionId, sessionId), eq(livePresence.userId, userId)));
}

export async function broadcastViewers(sessionId: string) {
  await signal(topics.live(sessionId), "live.viewers", { sessionId, count: await viewerCount(sessionId) });
}
