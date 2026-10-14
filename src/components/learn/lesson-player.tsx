"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { savePositionAction, setLessonCompleteAction } from "@/lib/actions/learning";

export function LessonPlayer({
  lessonId,
  src,
  startAt,
  nextHref,
  trackProgress,
  title,
}: {
  lessonId: string;
  src: string | null;
  startAt: number;
  nextHref: string | null;
  trackProgress: boolean;
  title: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(startAt);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  // Persist the resume point on pause, every ~15s of playback, and when leaving the page.
  useEffect(() => {
    const video = ref.current;
    if (!video || !trackProgress) return;
    const save = () => {
      const t = Math.floor(video.currentTime);
      if (Math.abs(t - lastSaved.current) < 5) return;
      lastSaved.current = t;
      void savePositionAction(lessonId, t);
    };
    const onTime = () => {
      if (Math.abs(video.currentTime - lastSaved.current) >= 15) save();
    };
    video.addEventListener("pause", save);
    video.addEventListener("timeupdate", onTime);
    document.addEventListener("visibilitychange", save);
    return () => {
      save();
      video.removeEventListener("pause", save);
      video.removeEventListener("timeupdate", onTime);
      document.removeEventListener("visibilitychange", save);
    };
  }, [lessonId, trackProgress]);

  if (!src) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card bg-blueprint px-4 py-3 text-sm text-muted-foreground">
        <FileText className="size-4 shrink-0 text-ember-hot" />
        Reading lesson. Work through the notes below, then mark it complete.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-black shadow-[0_30px_80px_-40px_rgb(255_122_47/.35)]">
      <video
        ref={ref}
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={`Video: ${title}`}
        className="aspect-video w-full bg-black"
        onLoadedMetadata={(e) => {
          if (startAt > 5 && startAt < e.currentTarget.duration - 5) e.currentTarget.currentTime = startAt;
        }}
        onPlay={() => setEnded(false)}
        onError={() => setFailed(true)}
        onEnded={() => {
          setEnded(true);
          if (trackProgress) {
            start(async () => {
              await setLessonCompleteAction(lessonId, true);
              router.refresh();
            });
          }
        }}
      />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm">
          <div>
            <p>The video couldn&apos;t load. The link may have expired.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.refresh()}>Reload video</Button>
          </div>
        </div>
      )}
      {ended && nextHref && (
        <div className="absolute inset-0 grid place-items-center bg-black/75 backdrop-blur-sm">
          <div className="text-center">
            <p className="font-display text-lg">Lesson complete</p>
            <div className="mt-4 flex justify-center gap-3">
              <Button variant="outline" onClick={() => { setEnded(false); ref.current?.play(); }}>Replay</Button>
              <Button className="bg-heat font-semibold" onClick={() => router.push(nextHref)}>Next lesson</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
