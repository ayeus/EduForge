import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { mux, muxConfigured } from "@/lib/live/mux";
import { syncWithMux } from "@/lib/live/sessions";

/**
 * Optional Mux webhook (set MUX_WEBHOOK_SECRET and point Mux at /api/webhooks/mux).
 * Without it, classes still go live: the control room and viewers poll Mux.
 */
export async function POST(request: Request) {
  if (!muxConfigured() || !process.env.MUX_WEBHOOK_SECRET) {
    return Response.json({ error: "Mux webhooks are not configured" }, { status: 503 });
  }
  const body = await request.text();
  let event;
  try {
    event = await mux().webhooks.unwrap(body, request.headers);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let streamId: string | undefined;
  if (event.type.startsWith("video.live_stream.")) {
    streamId = (event.data as { id?: string }).id;
  } else if (event.type === "video.asset.live_stream_completed" || event.type === "video.asset.ready") {
    streamId = (event.data as { live_stream_id?: string }).live_stream_id;
  }
  if (!streamId) return Response.json({ ok: true });

  const [session] = await db
    .select()
    .from(schema.liveSessions)
    .where(eq(schema.liveSessions.muxStreamId, streamId))
    .limit(1);
  if (session) {
    try {
      await syncWithMux(session, { force: true });
    } catch (err) {
      console.error("[live] webhook sync failed", err);
      return Response.json({ error: "Sync failed" }, { status: 500 });
    }
  }
  return Response.json({ ok: true });
}
