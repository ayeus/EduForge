import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { getLiveAccess, syncWithMux, touchHost, viewerCount } from "@/lib/live/sessions";

/**
 * Current state of a live class. Also nudges the session forward by checking Mux,
 * so classes go live even when Mux webhooks aren't configured.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/live/[id]/status">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });
  const access = await getLiveAccess(user, id);
  if (!access) return Response.json({ error: "Not found" }, { status: 404 });

  let { session } = access;
  // The broadcasting host's control room doubles as a heartbeat.
  const broadcasting = new URL(request.url).searchParams.get("broadcasting") === "1";
  if (broadcasting && access.isHost && session.broadcasterId === user.id && session.status === "live") {
    await touchHost(id);
    session = { ...session, hostSeenAt: new Date() };
  }
  let encoder: string = "unknown";
  try {
    const synced = await syncWithMux(session, { force: access.isHost });
    session = synced.session;
    encoder = synced.encoder;
  } catch (err) {
    console.error("[live] status sync failed", err);
  }
  return Response.json(
    {
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      hasReplay: !!session.replayPlaybackId || session.recordingKeys.length > 0,
      broadcastMode: session.broadcastMode,
      viewers: await viewerCount(id),
      ...(access.isHost ? { encoder } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
