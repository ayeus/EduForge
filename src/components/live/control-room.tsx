"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, MonitorPlay, RefreshCw, Square, Trash2, Webcam } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Countdown, LocalTime } from "@/components/local-time";
import { createStreamAction, deleteLiveAction, endLiveAction, resetStreamKeyAction } from "@/lib/actions/live";
import type { LiveStatus } from "@/lib/db/schema";
import type { PlayerTokens } from "@/lib/live/mux-types";
import type { Replay } from "@/lib/live/types";
import { cn } from "@/lib/utils";
import { SegmentPlayer } from "./browser-stream";
import { BrowserStudio, type StudioReport } from "./browser-studio";
import { LiveChat } from "./live-chat";
import { LivePlayer } from "./live-player";
import type { IceServerConfig, SignalEnvelope } from "./rtc/signals";
import { ReactionLayer } from "./reactions";
import { EditLiveDialog } from "./schedule-form";
import { LiveStatusPill } from "./status-pill";
import { useLiveRoom, type BroadcastMode, type ChatMessage } from "./use-live-room";

type Encoder = "idle" | "active" | "disabled" | "unknown";

type Props = {
  session: {
    id: string;
    title: string;
    description: string;
    scheduledFor: string;
    status: LiveStatus;
    startedAt: string | null;
    mode: BroadcastMode;
    broadcasterId: string | null;
  };
  course: { id: string; title: string };
  viewerId: string;
  muxReady: boolean;
  stream: { serverUrl: string; serverUrlPlain: string; streamKey: string } | null;
  live: { playbackId: string; tokens?: PlayerTokens } | null;
  replay: Replay;
  chat: ChatMessage[];
  pinned: string | null;
  viewers: number;
  iceServers: IceServerConfig[];
  maxViewers: number;
};

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  };
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm">
          {shown ? value : "•".repeat(Math.min(value.length, 28))}
        </code>
        {secret && (
          <Button variant="ghost" size="icon-lg" onClick={() => setShown((s) => !s)} aria-label={shown ? `Hide ${label}` : `Show ${label}`}>
            {shown ? <EyeOff /> : <Eye />}
          </Button>
        )}
        <Button variant="outline" size="icon-lg" onClick={() => void copy()} aria-label={`Copy ${label}`}>
          {copied ? <Check className="text-emerald-400" /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

/** Three stages a broadcast travels through, lit up as each one comes alive. */
function SignalChain({ encoder, status, viewers, muxReady }: { encoder: Encoder; status: LiveStatus; viewers: number; muxReady: boolean }) {
  const receiving = muxReady && (status === "live" || encoder === "active");
  const nodes = [
    {
      label: "Your encoder",
      state: !muxReady ? "Not connected" : receiving ? "Sending video" : status === "ended" ? "Stopped" : "Waiting for video",
      on: receiving,
    },
    {
      label: "Mux",
      state: !muxReady ? "Not configured" : receiving ? "Broadcasting" : status === "ended" ? "Recording saved" : "Ready",
      on: receiving,
      ready: muxReady && status !== "ended",
    },
    {
      label: "Students",
      state: status === "live" ? `${viewers} watching` : status === "ended" ? "Class over" : "In the waiting room",
      on: status === "live" && viewers > 0,
    },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Broadcast status">
      {nodes.map((n, i) => (
        <li key={n.label} className="relative">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
              n.on ? "border-ember/60 shadow-[0_0_30px_-12px_var(--ember)]" : "border-border",
            )}
          >
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                n.on ? "animate-live-pulse bg-ember" : n.ready ? "bg-emerald-400/80" : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{n.label}</div>
              <div className="truncate text-sm font-medium">{n.state}</div>
            </div>
          </div>
          {i < nodes.length - 1 && (
            <span
              className={cn(
                "absolute top-1/2 -right-3 hidden h-px w-3 sm:block",
                n.on ? "bg-ember" : "bg-border",
              )}
              aria-hidden
            />
          )}
        </li>
      ))}
    </ol>
  );
}

/** The browser broadcast's version of the chain: camera → recording → students. */
function BrowserChain({ report, status, viewers }: { report: StudioReport | null; status: LiveStatus; viewers: number }) {
  const phase = report?.phase ?? "off";
  const rec = report?.rec;
  const live = phase === "live";
  const nodes = [
    {
      label: "Your camera",
      state: live ? "Broadcasting" : phase === "off" ? "Off" : phase === "saving" || phase === "done" ? "Stopped" : "Ready",
      on: live,
      ready: phase === "preview" || phase === "starting",
    },
    {
      label: "Recording",
      state: rec?.recording
        ? "Recording"
        : rec && rec.pending > 0
          ? `Saving${rec.progress ? ` ${Math.round(rec.progress * 100)}%` : "…"}`
          : rec?.saved
            ? `Saved (${rec.saved} ${rec.saved === 1 ? "part" : "parts"})`
            : report?.recordOn === false
              ? "Off"
              : "Starts when you go live",
      on: !!rec?.recording,
      ready: !!rec?.saved,
    },
    {
      label: "Students",
      state: status === "live" ? `${live ? report!.viewers : viewers} watching` : status === "ended" ? "Class over" : "In the waiting room",
      on: status === "live" && (live ? report!.viewers : viewers) > 0,
    },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Broadcast status">
      {nodes.map((n, i) => (
        <li key={n.label} className="relative">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
              n.on ? "border-ember/60 shadow-[0_0_30px_-12px_var(--ember)]" : "border-border",
            )}
          >
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                n.on ? "animate-live-pulse bg-ember" : n.ready ? "bg-emerald-400/80" : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{n.label}</div>
              <div className="truncate text-sm font-medium">{n.state}</div>
            </div>
          </div>
          {i < nodes.length - 1 && (
            <span className={cn("absolute top-1/2 -right-3 hidden h-px w-3 sm:block", n.on ? "bg-ember" : "bg-border")} aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}

export function ControlRoom(props: Props) {
  const { session, course, viewerId, muxReady, stream, live, replay } = props;
  const signalHandler = useRef<((env: SignalEnvelope) => void) | null>(null);
  const registerSignalHandler = useCallback((fn: ((env: SignalEnvelope) => void) | null) => {
    signalHandler.current = fn;
  }, []);
  const room = useLiveRoom({
    sessionId: session.id,
    viewerId,
    status: session.status,
    mode: session.mode,
    chat: props.chat,
    pinned: props.pinned,
    viewers: props.viewers,
    onSignal: (env) => signalHandler.current?.(env),
  });
  const { status } = room;
  const [encoder, setEncoder] = useState<Encoder>("unknown");
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<"browser" | "encoder">(session.mode === "encoder" ? "encoder" : "browser");
  const [report, setReport] = useState<StudioReport | null>(null);
  const broadcasting = report?.phase === "live";
  const studioBusy = report?.phase === "live" || report?.phase === "starting" || report?.phase === "saving";
  const resumable = session.status === "live" && session.mode === "browser" && session.broadcasterId === viewerId;

  // Every few seconds: ask Mux for the encoder state, and (when broadcasting from this browser)
  // let the server know the host is still here.
  useEffect(() => {
    if (status === "ended") return;
    if (!broadcasting && !(method === "encoder" && stream)) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/live/${session.id}/status${broadcasting ? "?broadcasting=1" : ""}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { status: LiveStatus; encoder: Encoder; viewers: number };
        setEncoder(data.encoder);
        room.setViewers(data.viewers);
        if (data.status !== status) {
          room.setStatus(data.status);
          room.refresh();
        }
      } catch {}
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [session.id, status, stream, method, broadcasting]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (fn: () => Promise<{ error?: string; message?: string } | null | undefined>) =>
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else if (res?.message) toast.success(res.message);
      room.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Link href={`/studio/courses/${course.id}?tab=live`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {course.title}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-balance sm:text-3xl">{session.title}</h1>
            <LiveStatusPill status={status} hasReplay={!!replay} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Control room ·{" "}
            {status === "scheduled" ? (
              <>
                scheduled for <LocalTime iso={session.scheduledFor} /> (
                <Countdown iso={session.scheduledFor} fallback="start time reached" className="font-mono tabular-nums" />)
              </>
            ) : status === "live" ? (
              <>
                live since <LocalTime iso={session.startedAt ?? session.scheduledFor} format="time" />
              </>
            ) : (
              "ended"
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/live/${session.id}`} target="_blank"><ExternalLink /> Student view</Link>
          </Button>
          {status !== "ended" && (
            <EditLiveDialog
              sessionId={session.id}
              defaults={{ title: session.title, description: session.description, scheduledFor: session.scheduledFor }}
            />
          )}
          {status !== "ended" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className={status === "live" ? "bg-destructive text-white hover:bg-destructive/90" : undefined} variant={status === "live" ? "default" : "outline"}>
                  <Square /> End class
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End “{session.title}” for everyone?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {method === "browser"
                      ? "Your broadcast stops and chat closes. If you're recording, keep this tab open while the recording saves."
                      : "The stream stops immediately, chat closes and the stream key stops working."}{" "}
                    {status === "live" ? "Students get the recording as a replay." : ""}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep going</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => run(() => endLiveAction(session.id))}
                  >
                    End class
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><Trash2 /> Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this class?</AlertDialogTitle>
                  <AlertDialogDescription>The class page, its chat and the replay are removed for students.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => run(() => deleteLiveAction(session.id))}
                  >
                    Delete class
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1" role="tablist" aria-label="How you broadcast">
          {(
            [
              ["browser", Webcam, "From this browser"],
              ["encoder", MonitorPlay, "OBS or streaming app"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={method === value}
              disabled={studioBusy || (status === "live" && session.mode !== null && session.mode !== value && !resumable)}
              onClick={() => setMethod(value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
                method === value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {method === "browser"
            ? "Camera, microphone and screen sharing, right here. Best for classes up to " + props.maxViewers + "."
            : "Stream from OBS, Zoom or a phone through Mux. Best for large audiences."}
        </p>
      </div>

      <div className="mt-4">
        {method === "browser" ? (
          <BrowserChain report={report} status={status} viewers={room.viewers} />
        ) : (
          <SignalChain encoder={encoder} status={status} viewers={room.viewers} muxReady={muxReady} />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {method === "browser" && (status !== "ended" || studioBusy || report?.phase === "done") ? (
            <div className="relative">
              <BrowserStudio
                sessionId={session.id}
                courseId={course.id}
                status={status}
                resumable={resumable}
                startedAt={session.startedAt}
                iceServers={props.iceServers}
                maxViewers={props.maxViewers}
                registerSignalHandler={registerSignalHandler}
                onReport={setReport}
                onWentLive={() => {
                  room.setStatus("live");
                  room.setMode("browser");
                  room.refresh();
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 aspect-video">
                <ReactionLayer reactions={room.reactions} />
              </div>
            </div>
          ) : (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
            {status === "live" && live && session.mode !== "browser" ? (
              <LivePlayer playbackId={live.playbackId} tokens={live.tokens} live title={`Preview: ${session.title}`} viewerId={viewerId} />
            ) : status === "ended" && replay?.kind === "mux" ? (
              <LivePlayer playbackId={replay.playbackId} tokens={replay.tokens} live={false} title={session.title} viewerId={viewerId} />
            ) : status === "ended" && replay?.kind === "file" ? (
              <SegmentPlayer urls={replay.urls} title={session.title} />
            ) : (
              <div className="grid aspect-video place-items-center bg-blueprint p-6 text-center">
                <div>
                  <p className="font-display text-lg">
                    {status !== "ended"
                      ? "Preview appears when you go live"
                      : !session.startedAt
                        ? "This class ended without going live"
                        : live && session.mode !== "browser"
                          ? "Preparing the replay…"
                          : "This class has no recording"}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    {status !== "ended"
                      ? "Start streaming from your encoder with the settings below. Students are switched to the stream automatically."
                      : session.startedAt && live && session.mode !== "browser"
                        ? "Students can watch the recording here once Mux finishes processing it."
                        : "Schedule another class whenever you're ready."}
                  </p>
                </div>
              </div>
            )}
            <ReactionLayer reactions={room.reactions} />
          </div>
          )}

          {status !== "ended" && method === "encoder" && (
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="stream-settings">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="stream-settings" className="flex items-center gap-2 font-display text-base font-medium">
                  <KeyRound className="size-4 text-ember-hot" /> Stream settings
                </h2>
                {stream && status === "scheduled" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={pending}><RefreshCw /> Reset key</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Issue a new stream key?</AlertDialogTitle>
                        <AlertDialogDescription>The current key stops working. Do this if the key was shared by mistake.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => run(() => resetStreamKeyAction(session.id))}>Reset key</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {!muxReady ? (
                <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Video streaming isn&apos;t connected yet</p>
                  <p className="mt-1">
                    Add the Mux integration to this project (Vercel → Integrations → Mux) or set <code className="font-mono text-xs">MUX_TOKEN_ID</code> and{" "}
                    <code className="font-mono text-xs">MUX_TOKEN_SECRET</code>. Until then, the class page works as a waiting room with live chat.
                  </p>
                </div>
              ) : !stream ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border p-5 text-sm">
                  <p className="text-muted-foreground">This class doesn&apos;t have a stream yet.</p>
                  <Button disabled={pending} onClick={() => run(() => createStreamAction(session.id))} className="bg-heat font-semibold">
                    {pending && <Loader2 className="animate-spin" />} Create stream key
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-4">
                    <CopyField label="Server URL" value={stream.serverUrl} />
                    <CopyField label="Stream key (keep this private)" value={stream.streamKey} secret />
                  </div>
                  <Tabs defaultValue="obs" className="mt-6">
                    <TabsList>
                      <TabsTrigger value="obs" className="px-3">OBS Studio</TabsTrigger>
                      <TabsTrigger value="zoom" className="px-3">Zoom</TabsTrigger>
                      <TabsTrigger value="phone" className="px-3">Phone</TabsTrigger>
                    </TabsList>
                    <TabsContent value="obs" className="pt-4">
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-ember">
                        <li>Install OBS Studio (free) from obsproject.com and add your camera, screen or slides as sources.</li>
                        <li>Open <span className="text-foreground">Settings → Stream</span>, choose <span className="text-foreground">Custom</span>.</li>
                        <li>Paste the server URL and stream key above, then click <span className="text-foreground">Start Streaming</span>.</li>
                        <li>This page switches to <span className="text-foreground">Live</span> within a few seconds and notifies your students.</li>
                      </ol>
                    </TabsContent>
                    <TabsContent value="zoom" className="pt-4">
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-ember">
                        <li>In the Zoom web settings, turn on <span className="text-foreground">Allow live streaming meetings → Custom live streaming service</span>.</li>
                        <li>In your meeting, choose <span className="text-foreground">More → Live on Custom Live Streaming Service</span>.</li>
                        <li>Use the server URL as the stream URL, the stream key as the key, and this class&apos;s student link as the page URL.</li>
                      </ol>
                    </TabsContent>
                    <TabsContent value="phone" className="pt-4">
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-ember">
                        <li>Install an RTMP camera app such as Larix Broadcaster (iOS and Android).</li>
                        <li>Add a connection with the server URL followed by <span className="font-mono text-foreground">/</span> and your stream key.</li>
                        <li>If the app can&apos;t use RTMPS, use <span className="font-mono text-foreground">{stream.serverUrlPlain}</span> instead.</li>
                      </ol>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </section>
          )}
        </div>

        <LiveChat
          sessionId={session.id}
          viewerId={viewerId}
          isHost
          chat={room.chat}
          addChat={room.addChat}
          removeChat={(id) => room.setChat((list) => list.filter((m) => m.id !== id))}
          pinned={room.pinned}
          setPinned={room.setPinned}
          closed={status === "ended"}
          className="h-[min(680px,80dvh)] lg:sticky lg:top-24"
        />
      </div>
    </div>
  );
}
