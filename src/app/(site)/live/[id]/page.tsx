import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LiveRoom } from "@/components/live/live-room";
import { requireUser } from "@/lib/auth/dal";
import { playbackTokens } from "@/lib/live/mux";
import { getLiveAccess, getLiveChat, viewerCount } from "@/lib/live/sessions";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const access = await getLiveAccess(user, id);
  if (!access) notFound();
  return { user, ...access };
}

export async function generateMetadata({ params }: PageProps<"/live/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { session, course } = await load(id);
  return { title: `${session.title} · ${course.title}` };
}

export default async function LiveClassPage({ params }: PageProps<"/live/[id]">) {
  const { id } = await params;
  const { user, session, course, isHost } = await load(id);
  const [chat, viewers, liveTokens, replayTokens] = await Promise.all([
    getLiveChat(id, course.instructorId),
    viewerCount(id),
    session.muxPlaybackId && session.status !== "ended"
      ? playbackTokens(session.muxPlaybackId, session.signedPlayback, true)
      : undefined,
    session.replayPlaybackId ? playbackTokens(session.replayPlaybackId, session.signedPlayback, false) : undefined,
  ]);

  return (
    <LiveRoom
      session={{
        id: session.id,
        title: session.title,
        description: session.description,
        scheduledFor: session.scheduledFor.toISOString(),
        status: session.status,
        startedAt: session.startedAt?.toISOString() ?? null,
      }}
      course={{ id: course.id, title: course.title, instructorName: course.instructorName }}
      viewerId={user.id}
      isHost={isHost}
      live={session.muxPlaybackId ? { playbackId: session.muxPlaybackId, tokens: liveTokens } : null}
      replay={session.replayPlaybackId ? { playbackId: session.replayPlaybackId, tokens: replayTokens } : null}
      chat={chat}
      pinned={session.pinnedNote}
      viewers={viewers}
    />
  );
}
