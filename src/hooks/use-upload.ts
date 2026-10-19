"use client";

import { useCallback, useRef, useState } from "react";
import { uploadToStorage, type UploadKind } from "@/lib/upload-client";

export type { UploadKind };
export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number; name: string }
  | { status: "done"; key: string; name: string; durationSeconds?: number }
  | { status: "error"; message: string };

/** Best effort: some codecs can't be parsed by the browser, so give up after a few seconds. */
function readVideoDuration(file: File) {
  return new Promise<number | undefined>((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const finish = (d?: number) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      resolve(d);
    };
    const timer = setTimeout(() => finish(undefined), 5000);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => finish(Number.isFinite(v.duration) ? Math.round(v.duration) : undefined);
    v.onerror = () => finish(undefined);
    v.src = url;
  });
}

/** Uploads a file straight to storage using a presigned URL, reporting progress. */
export function useUpload(courseId: string, kind: UploadKind) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setState({ status: "uploading", progress: 0, name: file.name });
      try {
        const durationPromise = kind === "video" ? readVideoDuration(file) : Promise.resolve(undefined);
        const key = await uploadToStorage({
          courseId,
          kind,
          body: file,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          onProgress: (progress) => setState({ status: "uploading", progress, name: file.name }),
          onXhr: (xhr) => {
            xhrRef.current = xhr;
          },
        });

        const done: UploadState = { status: "done", key, name: file.name, durationSeconds: await durationPromise };
        setState(done);
        return done;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        setState({ status: "error", message });
        return null;
      } finally {
        xhrRef.current = null;
      }
    },
    [courseId, kind],
  );

  const cancel = useCallback(() => xhrRef.current?.abort(), []);
  const reset = useCallback(() => setState({ status: "idle" }), []);
  return { state, upload, cancel, reset };
}
