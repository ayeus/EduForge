"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, Mic, MicOff, MonitorUp, MonitorX, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { goLiveAction } from "@/lib/actions/live";
import type { LiveStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { Broadcaster, type ViewerInfo } from "./rtc/broadcaster";
import { SegmentRecorder, type RecorderState } from "./rtc/recorder";
import type { IceServerConfig, SignalEnvelope } from "./rtc/signals";

type Phase = "off" | "preview" | "starting" | "live" | "saving" | "done";
export type StudioReport = { phase: Phase; viewers: number; rec: RecorderState | null; recordOn: boolean };

const VIDEO: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
const AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

function mediaError(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Camera and microphone access is blocked. Allow it from the icon in the address bar, then try again.";
  if (name === "NotFoundError") return "No camera or microphone was found. Plug one in and try again.";
  if (name === "NotReadableError") return "Your camera or microphone is being used by another app. Close it and try again.";
  return "Couldn't start your camera or microphone.";
}

function elapsed(since: number) {
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h ? `${h}:` : ""}${pad(m)}:${pad(s % 60)}`;
}

/** Microphone level, 0..1, read from an analyser while the mic is on. */
function useMicLevel(track: MediaStreamTrack | null, on: boolean) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!track || !on) {
      if (bar.current) bar.current.style.transform = "scaleX(0)";
      return;
    }
    const ctx = new AudioContext();
    void ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
      if (bar.current) bar.current.style.transform = `scaleX(${level.toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [track, on]);
  return bar;
}

export function BrowserStudio({
  sessionId,
  courseId,
  status,
  resumable,
  startedAt,
  iceServers,
  maxViewers,
  registerSignalHandler,
  onReport,
  onWentLive,
}: {
  sessionId: string;
  courseId: string;
  status: LiveStatus;
  /** The class is live from this browser already (e.g. after a reload): offer to resume. */
  resumable: boolean;
  startedAt: string | null;
  iceServers: IceServerConfig[];
  maxViewers: number;
  registerSignalHandler: (fn: ((env: SignalEnvelope) => void) | null) => void;
  onReport: (report: StudioReport) => void;
  onWentLive: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("off");
  const [cam, setCam] = useState<MediaStreamTrack | null>(null);
  const [mic, setMic] = useState<MediaStreamTrack | null>(null);
  const [screen, setScreen] = useState<MediaStreamTrack | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [devices, setDevices] = useState<{ cams: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({ cams: [], mics: [] });
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState<ViewerInfo[]>([]);
  const [recordOn, setRecordOn] = useState(true);
  const [rec, setRec] = useState<RecorderState | null>(null);
  const [liveSince, setLiveSince] = useState<number | null>(startedAt ? new Date(startedAt).getTime() : null);
  const [, setTick] = useState(0);

  const preview = useRef<HTMLVideoElement>(null);
  const broadcaster = useRef<Broadcaster | null>(null);
  const recorder = useRef<SegmentRecorder | null>(null);
  const tracks = useRef({ cam, mic, screen });
  useEffect(() => {
    tracks.current = { cam, mic, screen };
  });

  const outgoingVideo = screen ?? cam;
  const micBar = useMicLevel(mic, micOn);

  // One broadcaster per mount; it only sends media once started.
  useEffect(() => {
    const b = new Broadcaster(sessionId, iceServers, maxViewers, setViewers);
    broadcaster.current = b;
    registerSignalHandler((env) => b.handle(env));
    return () => {
      registerSignalHandler(null);
      b.stop();
      void recorder.current?.stop();
      const t = tracks.current;
      [t.cam, t.mic, t.screen].forEach((x) => x?.stop());
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useRef(onReport);
  useEffect(() => {
    report.current = onReport;
  });
  useEffect(() => {
    report.current({ phase, viewers: viewers.filter((v) => v.connected).length, rec, recordOn });
  }, [phase, viewers, rec, recordOn]);

  useEffect(() => {
    if (preview.current) preview.current.srcObject = outgoingVideo ? new MediaStream([outgoingVideo]) : null;
  }, [outgoingVideo]);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(t);
      window.removeEventListener("beforeunload", warn);
    };
  }, [phase]);

  const refreshDevices = useCallback(async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices({ cams: list.filter((d) => d.kind === "videoinput"), mics: list.filter((d) => d.kind === "audioinput") });
  }, []);

  /** Send the current tracks to every viewer and to the recording. */
  const route = useCallback((video: MediaStreamTrack | null, audio: MediaStreamTrack | null) => {
    broadcaster.current?.setTracks(video, audio);
    if (recorder.current) recorder.current.start([video, audio].filter((t): t is MediaStreamTrack => !!t));
  }, []);

  const enableDevices = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't use the camera here. Browsers only allow it on https:// pages (or localhost).");
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: AUDIO });
      } catch (err) {
        // No camera (or it's busy): fall back to voice only.
        if (err instanceof DOMException && err.name === "NotAllowedError") throw err;
        stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
      }
      setCam(stream.getVideoTracks()[0] ?? null);
      setMic(stream.getAudioTracks()[0] ?? null);
      setCamOn(true);
      setMicOn(true);
      setPhase("preview");
      await refreshDevices();
    } catch (err) {
      setError(mediaError(err));
    }
  };

  const switchDevice = async (kind: "video" | "audio", deviceId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "video" ? { video: { ...VIDEO, deviceId: { exact: deviceId } } } : { audio: { ...AUDIO, deviceId: { exact: deviceId } } },
      );
      const track = kind === "video" ? stream.getVideoTracks()[0] : stream.getAudioTracks()[0];
      const t = tracks.current;
      if (kind === "video") {
        t.cam?.stop();
        track.enabled = camOn;
        setCam(track);
        if (!t.screen) route(track, t.mic);
      } else {
        t.mic?.stop();
        track.enabled = micOn;
        setMic(track);
        route(t.screen ?? t.cam, track);
      }
    } catch (err) {
      toast.error(mediaError(err));
    }
  };

  // Tracks are toggled through the ref: they're live media objects, not React state.
  const toggleCam = () => {
    const track = tracks.current.cam;
    if (!track) return;
    track.enabled = !camOn;
    setCamOn(!camOn);
  };

  const toggleMic = () => {
    const track = tracks.current.mic;
    if (!track) return;
    track.enabled = !micOn;
    setMicOn(!micOn);
  };

  const stopShare = useCallback(() => {
    const t = tracks.current;
    t.screen?.stop();
    setScreen(null);
    route(t.cam, t.mic);
  }, [route]);

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
      const track = stream.getVideoTracks()[0];
      track.contentHint = "detail";
      track.onended = () => stopShare();
      setScreen(track);
      route(track, tracks.current.mic);
    } catch {
      // The person closed the picker.
    }
  };

  const goLive = async () => {
    const video = outgoingVideo;
    if (!video && !mic) {
      toast.error("Turn on your camera or microphone first.");
      return;
    }
    setPhase("starting");
    const b = broadcaster.current!;
    b.setTracks(video, mic);
    b.start();
    const res = await goLiveAction(sessionId);
    if (res?.error) {
      b.stop();
      setPhase("preview");
      toast.error(res.error);
      return;
    }
    if (recordOn && SegmentRecorder.supported()) {
      recorder.current = new SegmentRecorder(courseId, sessionId, setRec);
      recorder.current.start([video, mic].filter((t): t is MediaStreamTrack => !!t));
    }
    setLiveSince((s) => s ?? Date.now());
    setPhase("live");
    onWentLive();
  };

  // The class ended (from the End class button or elsewhere): stop sending and save the recording.
  useEffect(() => {
    if (status !== "ended" || (phase !== "live" && phase !== "starting")) return;
    const b = broadcaster.current;
    b?.stop();
    const r = recorder.current;
    const finish = () => {
      const t = tracks.current;
      [t.cam, t.mic, t.screen].forEach((x) => x?.stop());
      setPhase("done");
    };
    if (r) {
      setPhase("saving");
      void r.stop().then(finish);
    } else {
      finish();
    }
  }, [status, phase]);

  const connected = viewers.filter((v) => v.connected).length;

  if (phase === "off") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-heat text-primary-foreground">
            <Radio className="size-6" />
          </span>
          <h2 className="mt-4 font-display text-lg font-medium">{resumable ? "You're live. Reconnect your camera" : "Broadcast from this browser"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {resumable
              ? "Your students are waiting. Turn your camera and microphone back on to continue the class."
              : "Use your camera, microphone and screen. No extra software needed. Your browser will ask for permission."}
          </p>
          {error && <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button onClick={() => void enableDevices()} className="mt-6 h-11 bg-heat px-6 font-semibold" disabled={status === "ended"}>
            <Camera /> Turn on camera and microphone
          </Button>
        </div>
      </div>
    );
  }

  const live = phase === "live";
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-video bg-black">
        <video
          ref={preview}
          autoPlay
          muted
          playsInline
          className={cn("size-full object-contain", !screen && "-scale-x-100", (!outgoingVideo || (!screen && !camOn)) && "invisible")}
          aria-label="Your preview"
        />
        {(!outgoingVideo || (!screen && !camOn)) && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            {outgoingVideo ? "Camera is off. Students hear you but see a blank screen." : "Voice only. No camera found."}
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {live ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] font-semibold text-ember-hot backdrop-blur">
              <span className="size-2 animate-live-pulse rounded-full bg-ember" aria-hidden /> LIVE {liveSince ? elapsed(liveSince) : ""}
            </span>
          ) : (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur">Preview. Only you can see this</span>
          )}
          {screen && <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-frost backdrop-blur">Sharing your screen</span>}
        </div>
        {rec?.recording && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] text-red-300 backdrop-blur">
            <span className="size-2 rounded-full bg-red-500" aria-hidden /> REC
          </span>
        )}
        {mic && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1.5 backdrop-blur" aria-hidden>
            {micOn ? <Mic className="size-3.5 text-frost" /> : <MicOff className="size-3.5 text-destructive" />}
            <span className="block h-1 w-20 overflow-hidden rounded-full bg-white/15">
              <span ref={micBar} className="block h-full origin-left scale-x-0 rounded-full bg-heat transition-transform duration-75" />
            </span>
          </div>
        )}
        {live && (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] text-frost backdrop-blur">
            {connected} {connected === 1 ? "student" : "students"} connected
          </span>
        )}
        {(phase === "saving" || phase === "done") && (
          <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
            <div className="max-w-sm text-sm">
              {phase === "saving" ? (
                <>
                  <Loader2 className="mx-auto mb-3 size-6 animate-spin text-ember-hot" />
                  <p className="font-medium">Saving the recording…</p>
                  <p className="mt-1 text-muted-foreground">
                    Keep this tab open.{rec && rec.progress > 0 ? ` Uploading ${Math.round(rec.progress * 100)}%.` : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Class ended</p>
                  <p className="mt-1 text-muted-foreground">
                    {rec?.saved ? "The recording is saved. Students can watch it from the class page." : "Thanks for teaching."}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {phase !== "saving" && phase !== "done" && (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={micOn ? "outline" : "destructive"} onClick={toggleMic} disabled={!mic} aria-pressed={!micOn}>
              {micOn ? <Mic /> : <MicOff />} {micOn ? "Mute" : "Unmute"}
            </Button>
            <Button variant={camOn ? "outline" : "destructive"} onClick={toggleCam} disabled={!cam} aria-pressed={!camOn}>
              {camOn ? <Camera /> : <CameraOff />} {camOn ? "Camera off" : "Camera on"}
            </Button>
            {typeof navigator !== "undefined" && "getDisplayMedia" in (navigator.mediaDevices ?? {}) &&
              (screen ? (
                <Button variant="outline" onClick={stopShare}>
                  <MonitorX /> Stop sharing
                </Button>
              ) : (
                <Button variant="outline" onClick={() => void shareScreen()}>
                  <MonitorUp /> Share screen
                </Button>
              ))}
            <div className="ml-auto">
              {live ? (
                <span className="text-sm text-muted-foreground">You&apos;re live. End the class from the top of the page.</span>
              ) : (
                <Button onClick={() => void goLive()} disabled={phase === "starting" || status === "ended"} className="h-10 bg-heat px-5 font-semibold">
                  {phase === "starting" ? <Loader2 className="animate-spin" /> : <Radio />}
                  {resumable ? "Resume broadcast" : "Go live"}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {devices.cams.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="cam-select" className="text-xs text-muted-foreground">Camera</Label>
                <Select value={cam?.getSettings().deviceId} onValueChange={(v) => void switchDevice("video", v)}>
                  <SelectTrigger id="cam-select" className="w-full"><SelectValue placeholder="Camera" /></SelectTrigger>
                  <SelectContent>
                    {devices.cams.map((d, i) => (
                      <SelectItem key={d.deviceId || i} value={d.deviceId || `cam-${i}`}>{d.label || `Camera ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {devices.mics.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="mic-select" className="text-xs text-muted-foreground">Microphone</Label>
                <Select value={mic?.getSettings().deviceId} onValueChange={(v) => void switchDevice("audio", v)}>
                  <SelectTrigger id="mic-select" className="w-full"><SelectValue placeholder="Microphone" /></SelectTrigger>
                  <SelectContent>
                    {devices.mics.map((d, i) => (
                      <SelectItem key={d.deviceId || i} value={d.deviceId || `mic-${i}`}>{d.label || `Microphone ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!live && SegmentRecorder.supported() && (
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 text-sm">
              <span>
                <span className="font-medium">Record this class</span>
                <span className="block text-xs text-muted-foreground">Students can watch the replay afterwards.</span>
              </span>
              <Switch checked={recordOn} onCheckedChange={setRecordOn} aria-label="Record this class" />
            </label>
          )}
          {rec?.error && <p className="text-sm text-destructive">Recording: {rec.error}</p>}
          <p className="text-xs text-muted-foreground">
            Browser broadcasts send a stream to each student directly, which suits classes of up to {maxViewers}. For bigger audiences, stream through OBS and Mux.
          </p>
        </div>
      )}
    </div>
  );
}
