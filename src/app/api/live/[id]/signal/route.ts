import { z } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { getLiveAccess } from "@/lib/live/sessions";
import { signal, topics } from "@/lib/realtime/server";

/**
 * WebRTC signalling for browser broadcasts. Viewers send to "host" (whoever is broadcasting);
 * the broadcaster sends to a viewer's user id. Messages travel over the realtime channel.
 */
const Body = z.object({
  to: z.union([z.literal("host"), z.uuid()]),
  messages: z.array(z.record(z.string(), z.unknown())).min(1).max(40),
});

type Access = NonNullable<Awaited<ReturnType<typeof getLiveAccess>>>;
const cache = new Map<string, { access: Access; expires: number }>();
const rate = new Map<string, { count: number; resetAt: number }>();

async function cachedAccess(user: CurrentUser, sessionId: string, { fresh = false } = {}) {
  const k = `${user.id}:${sessionId}`;
  const hit = cache.get(k);
  if (!fresh && hit && hit.expires > Date.now()) return hit.access;
  const access = await getLiveAccess(user, sessionId);
  if (!access) return null;
  if (cache.size > 2000) cache.clear();
  // Short-lived: who is broadcasting can change when the host goes live or hands over.
  cache.set(k, { access, expires: Date.now() + 5000 });
  return access;
}

function limited(userId: string) {
  const now = Date.now();
  const r = rate.get(userId);
  if (!r || r.resetAt < now) {
    if (rate.size > 5000) rate.clear();
    rate.set(userId, { count: 1, resetAt: now + 10_000 });
    return false;
  }
  r.count += 1;
  return r.count > 200;
}

export async function POST(request: Request, ctx: RouteContext<"/api/live/[id]/signal">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > 64_000) {
    return Response.json({ error: "Too large" }, { status: 413 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid signal" }, { status: 400 });
  if (limited(user.id)) return Response.json({ error: "Slow down" }, { status: 429 });

  let access = await cachedAccess(user, id);
  // Going live changes the session; don't let a cached copy turn a viewer away.
  if (access && parsed.data.to === "host" && (access.session.status !== "live" || !access.session.broadcasterId)) {
    access = await cachedAccess(user, id, { fresh: true });
  }
  if (!access) return Response.json({ error: "Not found" }, { status: 404 });
  const { session } = access;
  if (session.status !== "live" && parsed.data.to === "host") {
    // A viewer saying goodbye after the class ended needs no answer.
    if (parsed.data.messages.every((m) => m.kind === "leave")) return new Response(null, { status: 204 });
    return Response.json({ error: "The class isn't live" }, { status: 409 });
  }

  let target: string;
  if (parsed.data.to === "host") {
    if (!session.broadcasterId) return Response.json({ error: "Nobody is broadcasting" }, { status: 409 });
    target = session.broadcasterId;
  } else {
    // Only the person broadcasting may signal viewers.
    if (!access.isHost) return Response.json({ error: "Not allowed" }, { status: 403 });
    target = parsed.data.to;
  }

  await signal(topics.liveSignal(id, target), "live.signal", {
    sessionId: id,
    from: user.id,
    fromName: user.name,
    messages: parsed.data.messages,
  });
  return new Response(null, { status: 204 });
}
