"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, Eye, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Countdown, LocalTime } from "@/components/local-time";
import type { LiveStatus } from "@/lib/db/schema";
import type { PlayerTokens } from "@/lib/live/mux-types";
import { LiveChat } from "./live-chat";
import { LivePlayer } from "./live-player";
import { ReactionBar, ReactionLayer } from "./reactions";
import { LiveStatusPill } from "./status-pill";
import { useLiveRoom, type ChatMessage } from "./use-live-room";

type Props = {
  session: { id: string; title: string; description: string; scheduledFor: string; status: LiveStatus; startedAt: string | null };
  course: { id: string; title: string; instructorName: string };
  viewerId: string;
  isHost: boolean;
  live: { playbackId: string; tokens?: PlayerTokens } | null;
  replay: { playbackId: string; tokens?: PlayerTokens } | null;
  chat: ChatMessage[];
  pinned: string | null;
  viewers: number;
};

/** Poll the status endpoint while something might change soon; realtime events usually beat it. */
function useStatusPoll(sessionId: string, active: boolean, every: number, onStatus: (s: LiveStatus) => void) {
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/live/${sessionId}/status`, { cache: "no-store" });
        if (res.ok && !stopped) onStatus(((await res.json()) as { status: LiveStatus }).status);
      } catch {}
    };
    void tick();
    const t = setInterval(tick, every);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [sessionId, active, every]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function LiveRoom({ session, course, viewerId, isHost, live, replay, chat, pinned, viewers }: Props) {
  const room = useLiveRoom({ sessionId: session.id, viewerId, status: session.status, chat, pinned, viewers });
  const { status } = room;
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  });
  const startsAt = new Date(session.scheduledFor).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Check Mux around the scheduled time in case the class went live without a realtime event reaching us.
  const nearStart = status === "scheduled" && now > startsAt - 15 * 60_000;
  useStatusPoll(session.id, nearStart || status === "live", 15_000, (s) => {
    if (s !== statusRef.current) {
      room.setStatus(s);
      room.refresh();
    }
  });
  // After the class, wait for the recording to finish processing.
  useStatusPoll(session.id, status === "ended" && !replay && !!session.startedAt && !!live, 20_000, () => room.refresh());

  const showLive = status === "live" && live;
  const showReplay = status === "ended" && replay;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/live" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Live classes
        </Link>
        <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
        <Link href={`/courses/${course.id}`} className="min-w-0 truncate text-sm text-muted-foreground hover:text-foreground">
          {course.title}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {status === "live" && (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground tabular-nums" aria-label={`${room.viewers} watching`}>
              <Eye className="size-3.5" /> {room.viewers}
            </span>
          )}
          <LiveStatusPill status={status} hasReplay={!!replay} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-black shadow-[0_30px_80px_-40px_rgb(255_122_47/0.35)]">
            {showLive ? (
              <LivePlayer playbackId={live.playbackId} tokens={live.tokens} live title={session.title} viewerId={viewerId} />
            ) : showReplay ? (
              <LivePlayer playbackId={replay.playbackId} tokens={replay.tokens} live={false} title={session.title} viewerId={viewerId} />
            ) : (
              <Stage status={status} session={session} hasStream={!!live} />
            )}
            <ReactionLayer reactions={room.reactions} />
          </div>

          {status === "live" && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <ReactionBar sessionId={session.id} onLocal={room.spawnReaction} />
              {isHost && (
                <Button asChild variant="outline" size="lg">
                  <Link href={`/studio/live/${session.id}`}><Radio /> Control room</Link>
                </Button>
              )}
            </div>
          )}

          <div className="mt-6">
            <h1 className="font-display text-2xl font-semibold text-balance sm:text-3xl">{session.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              With <span className="text-foreground">{course.instructorName}</span> ·{" "}
              <LocalTime iso={session.startedAt ?? session.scheduledFor} />
            </p>
            {session.description && (
              <p className="mt-5 max-w-[70ch] leading-relaxed whitespace-pre-wrap text-foreground/85">{session.description}</p>
            )}
          </div>
        </div>

        <LiveChat
          sessionId={session.id}
          viewerId={viewerId}
          isHost={isHost}
          chat={room.chat}
          addChat={room.addChat}
          removeChat={(id) => room.setChat((list) => list.filter((m) => m.id !== id))}
          pinned={room.pinned}
          setPinned={room.setPinned}
          closed={status === "ended"}
          className="h-[min(640px,75dvh)] lg:sticky lg:top-24"
        />
      </div>
    </div>
  );
}

function Stage({ status, session, hasStream }: { status: LiveStatus; session: Props["session"]; hasStream: boolean }) {
  return (
    <div className="relative grid aspect-video place-items-center bg-blueprint bg-background p-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_60%,rgb(255_122_47/0.12),transparent_70%)]"
        aria-hidden
      />
      <div className="relative">
        {status === "scheduled" ? (
          <>
            <p className="text-sm text-muted-foreground">Class starts in</p>
            <Countdown
              iso={session.scheduledFor}
              fallback={<span className="text-3xl sm:text-4xl">Starting any moment</span>}
              className="mt-2 block font-mono text-4xl font-medium text-heat tabular-nums sm:text-6xl"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              <LocalTime iso={session.scheduledFor} format="full" />
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" size="lg">
                <a href={`/api/live/${session.id}/calendar`}><CalendarPlus /> Add to calendar</a>
              </Button>
            </div>
            <p className="mx-auto mt-5 max-w-sm text-xs text-muted-foreground">
              Keep this page open. The video starts on its own, and you&apos;ll get a notification the moment the class goes live.
            </p>
          </>
        ) : status === "live" ? (
          <>
            <p className="font-display text-xl">The class is live</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {hasStream ? "Connecting to the stream…" : "Video isn't available for this class. Follow along in the chat."}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-xl">This class has ended</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {!session.startedAt
                ? "It didn't go live, so there's no recording."
                : hasStream
                  ? "The recording is being prepared and will appear here automatically."
                  : "There's no recording of this class."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
