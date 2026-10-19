import "server-only";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Realtime fan-out on plain Postgres.
 *
 * Every event is written to `realtime_events` and announced with NOTIFY. Each server
 * instance keeps one LISTEN connection while it has subscribers and forwards events to
 * the Server-Sent Event streams it is serving. The table doubles as a replay log, so a
 * browser that reconnects (the SSE route closes every few minutes) receives what it missed.
 *
 * If LISTEN isn't available (for example behind a transaction-mode pooler), the instance
 * falls back to polling the log once per second, shared by all of its connections.
 */

export type RealtimeEvent = { id?: number; topic: string; type: string; data: unknown };
type Listener = (event: RealtimeEvent) => void;

const CHANNEL = "ef_rt";
const MAX_NOTIFY_BYTES = 7500;

export const topics = {
  user: (id: string) => `user:${id}`,
  course: (id: string) => `course:${id}`,
  live: (id: string) => `live:${id}`,
  /** Private WebRTC signalling for one person in one live class. */
  liveSignal: (sessionId: string, userId: string) => `livesig:${sessionId}:${userId}`,
};

type Publishable = { topic: string; type: string; data: unknown };

/** Persist events and wake every instance with subscribers for their topics. */
export async function publish(...events: Publishable[]) {
  if (!events.length) return;
  const rows = sql.join(
    events.map((e) => sql`(${e.topic}, ${e.type}, ${JSON.stringify(e.data)}::jsonb)`),
    sql`, `,
  );
  await db.execute(sql`
    with e as (
      insert into realtime_events (topic, type, data) values ${rows} returning id, topic
    )
    select pg_notify(${CHANNEL}, e.id::text || ' ' || e.topic) from e
  `);
  if (Math.random() < 0.02) {
    db.execute(sql`delete from realtime_events where created_at < now() - interval '1 day'`).catch(() => {});
  }
}

/** Fire-and-forget signal (typing, reactions, viewer counts). Not stored, not replayed. */
export async function signal(topic: string, type: string, data: unknown) {
  const payload = `~${JSON.stringify({ topic, type, data })}`;
  if (Buffer.byteLength(payload) > MAX_NOTIFY_BYTES) return publish({ topic, type, data });
  await db.execute(sql`select pg_notify(${CHANNEL}, ${payload})`);
}

/** Events for `topicList` with ids above `afterId`, oldest first. Used to replay after a reconnect. */
export async function eventsSince(topicList: string[], afterId: number, limit = 200) {
  if (!afterId || !topicList.length) return [];
  const rows = await db.execute<{ id: string; topic: string; type: string; data: unknown }>(sql`
    select id, topic, type, data from realtime_events
    where id > ${afterId}
      and topic in ${topicList}
      and created_at > now() - interval '15 minutes'
    order by id
    limit ${limit}
  `);
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

function listenUrl() {
  // `||` so empty values copied from .env.example count as unset.
  const direct =
    process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DIRECT_URL;
  if (direct) return direct;
  // Neon names its pooled host "<endpoint>-pooler.<region>"; the direct host drops the suffix.
  return process.env.DATABASE_URL!.replace("-pooler.", ".");
}

class Hub {
  private listeners = new Map<string, Set<Listener>>();
  private mode: "idle" | "starting" | "listen" | "poll" = "idle";
  private client: postgres.Sql | null = null;
  private lastId = 0;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private pending = new Set<number>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private catchingUp = false;

  subscribe(topicList: string[], fn: Listener) {
    for (const t of topicList) {
      let set = this.listeners.get(t);
      if (!set) this.listeners.set(t, (set = new Set()));
      set.add(fn);
    }
    clearTimeout(this.idleTimer);
    void this.start();
    return () => {
      for (const t of topicList) {
        const set = this.listeners.get(t);
        set?.delete(fn);
        if (set && !set.size) this.listeners.delete(t);
      }
      if (!this.listeners.size) {
        clearTimeout(this.idleTimer);
        // Keep the connection briefly so quick reconnects don't churn it.
        this.idleTimer = setTimeout(() => this.stop(), 60_000);
      }
    };
  }

  private dispatch(event: RealtimeEvent) {
    const set = this.listeners.get(event.topic);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(event);
      } catch (err) {
        console.error("[realtime] listener failed", err);
      }
    }
  }

  private async start() {
    if (this.mode !== "idle") return;
    this.mode = "starting";
    try {
      const [row] = await db.execute<{ id: string }>(sql`select coalesce(max(id), 0) as id from realtime_events`);
      this.lastId = Number(row?.id ?? 0);
    } catch (err) {
      console.error("[realtime] could not read the event log", err);
    }
    try {
      const client = postgres(listenUrl(), { max: 1, prepare: false, onnotice: () => {} });
      this.client = client;
      await Promise.race([
        client.listen(
          CHANNEL,
          (payload) => this.onNotify(payload),
          () => void this.catchUp(),
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error("LISTEN timed out")), 5000)),
      ]);
      this.mode = "listen";
    } catch (err) {
      console.warn("[realtime] LISTEN unavailable, polling instead:", (err as Error).message);
      this.client?.end({ timeout: 1 }).catch(() => {});
      this.client = null;
      this.mode = "poll";
      this.pollTimer = setInterval(() => void this.catchUp(), 1000);
    }
  }

  private stop() {
    if (this.listeners.size) return;
    clearInterval(this.pollTimer);
    clearTimeout(this.flushTimer);
    this.pending.clear();
    this.client?.end({ timeout: 1 }).catch(() => {});
    this.client = null;
    this.mode = "idle";
  }

  private onNotify(payload: string) {
    if (payload.startsWith("~")) {
      try {
        this.dispatch(JSON.parse(payload.slice(1)) as RealtimeEvent);
      } catch {}
      return;
    }
    const space = payload.indexOf(" ");
    const id = Number(payload.slice(0, space));
    const topic = payload.slice(space + 1);
    if (id > this.lastId) this.lastId = id;
    if (!this.listeners.has(topic)) return;
    this.pending.add(id);
    this.flushTimer ??= setTimeout(() => void this.flush(), 5);
  }

  /** Load the bodies of announced events in one query and hand them out. */
  private async flush() {
    this.flushTimer = undefined;
    const ids = [...this.pending];
    this.pending.clear();
    if (!ids.length) return;
    try {
      const rows = await db.execute<{ id: string; topic: string; type: string; data: unknown }>(
        sql`select id, topic, type, data from realtime_events where id in ${ids} order by id`,
      );
      for (const r of rows) this.dispatch({ ...r, id: Number(r.id) });
    } catch (err) {
      console.error("[realtime] could not load events", err);
    }
  }

  /** Pull anything newer than the last event seen (after a reconnect, or when polling). */
  private async catchUp() {
    if (this.catchingUp) return;
    this.catchingUp = true;
    try {
      const rows = await db.execute<{ id: string; topic: string; type: string; data: unknown }>(
        sql`select id, topic, type, data from realtime_events where id > ${this.lastId} order by id limit 1000`,
      );
      for (const r of rows) {
        const id = Number(r.id);
        if (id > this.lastId) this.lastId = id;
        this.dispatch({ ...r, id });
      }
    } catch (err) {
      console.error("[realtime] catch-up failed", err);
    } finally {
      this.catchingUp = false;
    }
  }
}

const globalForHub = globalThis as unknown as { realtimeHub?: Hub };
export const hub = (globalForHub.realtimeHub ??= new Hub());
