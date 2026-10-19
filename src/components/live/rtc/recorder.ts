import { addRecordingSegmentAction } from "@/lib/actions/live";
import { uploadToStorage } from "@/lib/upload-client";

export type RecorderState = { recording: boolean; pending: number; progress: number; saved: number; error?: string };

const TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
const SEGMENT_MS = 10 * 60_000;

/**
 * Records the host's broadcast in segments. A new segment starts whenever the source changes
 * (MediaRecorder can't switch tracks mid-file) and every ten minutes; each finished segment
 * is uploaded in the background and appended to the class replay.
 */
export class SegmentRecorder {
  private rec: MediaRecorder | null = null;
  private stopped: Promise<void> = Promise.resolve();
  private uploads: Promise<void> = Promise.resolve();
  private rotateTimer: ReturnType<typeof setTimeout> | undefined;
  private part = 0;
  private state: RecorderState = { recording: false, pending: 0, progress: 0, saved: 0 };
  private courseId: string;
  private sessionId: string;
  private onState: (s: RecorderState) => void;

  constructor(courseId: string, sessionId: string, onState: (s: RecorderState) => void) {
    this.courseId = courseId;
    this.sessionId = sessionId;
    this.onState = onState;
  }

  static supported() {
    return typeof MediaRecorder !== "undefined" && TYPES.some((t) => MediaRecorder.isTypeSupported(t));
  }

  private set(patch: Partial<RecorderState>) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
  }

  /** Start recording these tracks, closing the current segment first. */
  start(tracks: MediaStreamTrack[]) {
    this.closeSegment();
    const live = tracks.filter((t) => t.readyState === "live");
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    if (!live.length || !mimeType) return;

    const rec = new MediaRecorder(new MediaStream(live), { mimeType, videoBitsPerSecond: 1_200_000, audioBitsPerSecond: 64_000 });
    const chunks: Blob[] = [];
    const startedAt = performance.now();
    const part = ++this.part;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    this.stopped = new Promise<void>((resolve) => {
      rec.onstop = () => {
        const type = mimeType.split(";")[0];
        this.enqueue(new Blob(chunks, { type }), performance.now() - startedAt, part);
        resolve();
      };
    });
    rec.start(5000);
    this.rec = rec;
    this.set({ recording: true, error: undefined });
    this.rotateTimer = setTimeout(() => this.start(live), SEGMENT_MS);
  }

  private closeSegment() {
    clearTimeout(this.rotateTimer);
    if (this.rec && this.rec.state !== "inactive") this.rec.stop();
    this.rec = null;
  }

  /** Finish recording and wait until every segment has been uploaded. */
  async stop() {
    this.closeSegment();
    this.set({ recording: false });
    await this.stopped;
    await this.uploads;
  }

  private enqueue(blob: Blob, durationMs: number, part: number) {
    // Skip slivers (e.g. a source switch right after starting).
    if (blob.size < 20_000 || durationMs < 1000) return;
    this.set({ pending: this.state.pending + 1 });
    this.uploads = this.uploads.then(async () => {
      try {
        let body = blob;
        if (blob.type === "video/webm") {
          // MediaRecorder leaves the duration out of WebM files, which breaks seeking.
          const { default: fixWebmDuration } = await import("fix-webm-duration");
          body = await fixWebmDuration(blob, durationMs, { logger: false });
        }
        const ext = blob.type === "video/mp4" ? "mp4" : "webm";
        const key = await uploadToStorage({
          courseId: this.courseId,
          kind: "video",
          body,
          filename: `live-${this.sessionId.slice(0, 8)}-part-${part}.${ext}`,
          contentType: blob.type,
          onProgress: (progress) => this.set({ progress }),
        });
        const res = await addRecordingSegmentAction(this.sessionId, key);
        if (res?.error) throw new Error(res.error);
        this.set({ saved: this.state.saved + 1 });
      } catch (err) {
        this.set({ error: err instanceof Error ? err.message : "Couldn't save part of the recording." });
      } finally {
        this.set({ pending: this.state.pending - 1, progress: 0 });
      }
    });
  }
}
