"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IceServerConfig, SignalEnvelope } from "./rtc/signals";
import { Viewer, type ViewerState } from "./rtc/viewer";

/** Connects to the host's browser broadcast while `enabled`. */
export function useBrowserStream({ sessionId, enabled, iceServers }: { sessionId: string; enabled: boolean; iceServers: IceServerConfig[] }) {
  const viewer = useRef<Viewer | null>(null);
  const [state, setState] = useState<ViewerState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const ice = useRef(iceServers);

  useEffect(() => {
    if (!enabled) return;
    const v = new Viewer(sessionId, ice.current, setState, setStream);
    viewer.current = v;
    v.start();
    const onHide = () => v.stop();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      v.stop();
      viewer.current = null;
    };
  }, [sessionId, enabled]);

  const handleSignal = useCallback((env: SignalEnvelope) => viewer.current?.handle(env), []);
  const rejoin = useCallback(() => viewer.current?.rejoin(), []);
  return { state, stream, handleSignal, rejoin };
}

/** The student's view of a browser broadcast: low-latency video with minimal controls. */
export function BrowserStreamPlayer({ stream, state, title }: { stream: MediaStream | null; state: ViewerState; title: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.srcObject = stream;
    if (!stream) return;
    v.muted = false;
    v.play().then(
      () => {
        setMuted(false);
        setBlocked(false);
      },
      () => {
        // Autoplay with sound was blocked: start muted and offer a tap to unmute.
        v.muted = true;
        setMuted(true);
        setBlocked(true);
        void v.play().catch(() => {});
      },
    );
  }, [stream]);

  const toggleMute = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    setBlocked(false);
    void v.play().catch(() => {});
  };

  const overlay =
    state === "full"
      ? "This class is full in browser mode. Ask your instructor to stream through Mux for larger audiences."
      : state === "reconnecting"
        ? "Reconnecting to your instructor…"
        : !stream || state === "connecting"
          ? "Connecting to the class…"
          : null;

  return (
    <div ref={box} className="group relative aspect-video bg-black">
      <video ref={video} playsInline autoPlay className="size-full object-contain" aria-label={`Live: ${title}`} />
      {overlay && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 p-6 text-center text-sm text-muted-foreground backdrop-blur-sm">
          <div className="flex max-w-sm flex-col items-center gap-3">
            {state !== "full" && <Loader2 className="size-6 animate-spin text-ember-hot" />}
            {overlay}
          </div>
        </div>
      )}
      {blocked && stream && (
        <button
          type="button"
          onClick={toggleMute}
          className="absolute top-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-heat px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg"
        >
          <VolumeX className="size-4" /> Tap to unmute
        </button>
      )}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
          !stream && "hidden",
        )}
      >
        <Button variant="ghost" size="icon-lg" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="text-white">
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void box.current?.requestFullscreen())}
          aria-label="Full screen"
          className="text-white"
        >
          <Maximize />
        </Button>
      </div>
    </div>
  );
}

/** Plays a browser-recorded replay, one segment after another. */
export function SegmentPlayer({ urls, title }: { urls: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const advance = useRef(false);

  useEffect(() => {
    if (advance.current) void video.current?.play().catch(() => {});
  }, [index]);

  return (
    <div className="relative bg-black">
      <video
        ref={video}
        key={urls[index]}
        src={urls[index]}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full"
        aria-label={`Recording: ${title}`}
        onEnded={() => {
          if (index < urls.length - 1) {
            advance.current = true;
            setIndex(index + 1);
          }
        }}
      />
      {urls.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="mr-1">Recording parts</span>
          {urls.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                advance.current = true;
                setIndex(i);
              }}
              aria-current={i === index ? "true" : undefined}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono tabular-nums",
                i === index ? "border-ember/60 bg-ember/10 text-ember-hot" : "border-border hover:text-foreground",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
