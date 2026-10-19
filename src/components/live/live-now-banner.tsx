"use client";

import { useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { useRealtime } from "@/components/realtime/provider";

type Live = { id: string; title: string };
type StatusEvent = { sessionId: string; courseId: string; status: string; title: string };

/** "Live now" strip for a course; appears and disappears as the instructor goes live or ends. */
export function LiveNowBanner({ courseId, initial }: { courseId: string; initial: Live | null }) {
  const [live, setLive] = useState(initial);

  useRealtime((m) => {
    if (m.type !== "live.status") return;
    const e = m.data as StatusEvent;
    if (e.courseId !== courseId) return;
    if (e.status === "live") setLive({ id: e.sessionId, title: e.title });
    else if (live?.id === e.sessionId) setLive(null);
  });

  if (!live) return null;
  return (
    <Link
      href={`/live/${live.id}`}
      className="group flex items-center gap-3 border-b border-ember/40 bg-ember/10 px-4 py-2.5 text-sm transition-colors hover:bg-ember/15"
    >
      <span className="size-2 shrink-0 animate-live-pulse rounded-full bg-ember" aria-hidden />
      <span className="font-mono text-[11px] font-semibold tracking-wide text-ember-hot">LIVE</span>
      <span className="min-w-0 flex-1 truncate">{live.title}</span>
      <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-ember-hot group-hover:underline">
        <Radio className="size-3.5" /> Join class
      </span>
    </Link>
  );
}
