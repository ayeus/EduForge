import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { broadcastViewers, getLiveAccess, leavePresence, touchPresence } from "@/lib/live/sessions";
import { eventsSince, hub, topics, type RealtimeEvent } from "@/lib/realtime/server";

// Server-Sent Events. Each connection lives for a few minutes, then the browser
// reconnects with Last-Event-ID and the route replays anything it missed.
export const maxDuration = 300;
const LIFETIME_MS = 270_000;
const HEARTBEAT_MS = 20_000;

/**
 * Course-wide channels for enrolled and owned courses. Instructors follow their own courses
 * for live status, but not the notifications those courses send to students.
 */
async function courseTopics(userId: string) {
  const [enrolled, owned] = await Promise.all([
    db.select({ id: schema.enrollments.courseId }).from(schema.enrollments).where(eq(schema.enrollments.userId, userId)),
    db.select({ id: schema.courses.id }).from(schema.courses).where(eq(schema.courses.instructorId, userId)),
  ]);
  const enrolledTopics = new Set(enrolled.map((r) => topics.course(r.id)));
  const ownedOnly = new Set(owned.map((r) => topics.course(r.id)).filter((t) => !enrolledTopics.has(t)));
  return { all: [...new Set([...enrolledTopics, ...ownedOnly])], ownedOnly };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const liveId = url.searchParams.get("live");
  let subscribed: string[];
  let ownedOnly = new Set<string>();
  // Hosts follow their own class but aren't counted as viewers.
  let countsAsViewer = false;
  if (liveId) {
    if (!z.uuid().safeParse(liveId).success) return new Response("Not found", { status: 404 });
    const access = await getLiveAccess(user, liveId);
    if (!access) return new Response("Not found", { status: 404 });
    subscribed = [topics.live(liveId), topics.liveSignal(liveId, user.id)];
    countsAsViewer = !access.isHost;
  } else {
    const courses = await courseTopics(user.id);
    subscribed = [topics.user(user.id), ...courses.all];
    ownedOnly = courses.ownedOnly;
  }
  const lastEventId = Number(request.headers.get("last-event-id") ?? url.searchParams.get("lastEventId")) || 0;

  const encoder = new TextEncoder();
  let close: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = (e: RealtimeEvent) => {
        if (e.type === "notification" && ownedOnly.has(e.topic)) return;
        write(`${e.id ? `id: ${e.id}\n` : ""}data: ${JSON.stringify({ topic: e.topic, type: e.type, data: e.data })}\n\n`);
      };

      // Hold live events until the replay below has been sent, so nothing arrives out of order.
      let buffer: RealtimeEvent[] | null = [];
      const unsubscribe = hub.subscribe(subscribed, (e) => (buffer ? buffer.push(e) : send(e)));

      close = () => {
        if (closed) return;
        closed = true;
        timers.forEach(clearTimeout);
        unsubscribe();
        if (liveId && countsAsViewer) {
          leavePresence(liveId, user.id)
            .then(() => broadcastViewers(liveId))
            .catch(() => {});
        }
        try {
          controller.close();
        } catch {}
      };
      request.signal.addEventListener("abort", close);

      // Reconnect after 3s; the padding comment defeats Safari's 1 KB buffering.
      write(`retry: 3000\n:${" ".repeat(2048)}\n\n`);
      write(`data: ${JSON.stringify({ topic: "system", type: "ready", data: { at: Date.now() } })}\n\n`);

      try {
        const missed = await eventsSince(subscribed, lastEventId);
        const sent = new Set<number>();
        for (const e of missed) {
          sent.add(e.id);
          send(e);
        }
        const pending = buffer;
        buffer = null;
        for (const e of pending) if (!e.id || !sent.has(e.id)) send(e);
      } catch (err) {
        console.error("[realtime] replay failed", err);
        const pending = buffer ?? [];
        buffer = null;
        pending.forEach(send);
      }

      const touch = async () => {
        if (liveId) {
          if (countsAsViewer) {
            await touchPresence(liveId, user.id);
            await broadcastViewers(liveId);
          }
        } else {
          await db.update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, user.id));
        }
      };
      touch().catch(() => {});
      timers.push(setInterval(() => write(": ping\n\n"), HEARTBEAT_MS));
      timers.push(setInterval(() => touch().catch(() => {}), liveId ? 20_000 : 60_000));
      timers.push(setTimeout(close, LIFETIME_MS));
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
