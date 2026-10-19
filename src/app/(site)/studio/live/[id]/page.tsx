import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ControlRoom } from "@/components/live/control-room";
import { requireRole } from "@/lib/auth/dal";
import { RTMP_SERVER_URL, RTMP_SERVER_URL_PLAIN, muxConfigured, playbackTokens } from "@/lib/live/mux";
import { replayFor } from "@/lib/live/replay";
import { getLiveAccess, getLiveChat, viewerCount } from "@/lib/live/sessions";
import { iceServers, maxBrowserViewers } from "@/lib/live/webrtc";

export const metadata: Metadata = { title: "Control room" };

export default async function ControlRoomPage({ params }: PageProps<"/studio/live/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireRole("instructor");
  const access = await getLiveAccess(user, id);
  if (!access?.isHost) notFound();
  const { session, course } = access;

  const [chat, viewers, liveTokens, replay] = await Promise.all([
    getLiveChat(id, course.instructorId),
    viewerCount(id),
    session.muxPlaybackId && session.status !== "ended" ? playbackTokens(session.muxPlaybackId, session.signedPlayback, true) : undefined,
    replayFor(session),
  ]);

  return (
    <ControlRoom
      session={{
        id: session.id,
        title: session.title,
        description: session.description,
        scheduledFor: session.scheduledFor.toISOString(),
        status: session.status,
        startedAt: session.startedAt?.toISOString() ?? null,
        mode: session.broadcastMode,
        broadcasterId: session.broadcasterId,
      }}
      course={{ id: course.id, title: course.title }}
      viewerId={user.id}
      muxReady={muxConfigured()}
      stream={
        session.muxStreamKey
          ? { serverUrl: RTMP_SERVER_URL, serverUrlPlain: RTMP_SERVER_URL_PLAIN, streamKey: session.muxStreamKey }
          : null
      }
      live={session.muxPlaybackId ? { playbackId: session.muxPlaybackId, tokens: liveTokens } : null}
      replay={replay}
      chat={chat}
      pinned={session.pinnedNote}
      viewers={viewers}
      iceServers={iceServers()}
      maxViewers={maxBrowserViewers()}
    />
  );
}
