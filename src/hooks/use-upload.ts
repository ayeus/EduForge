"use client";

import { useCallback, useRef, useState } from "react";

export type UploadKind = "video" | "attachment" | "cover";
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
        const contentType = file.type || "application/octet-stream";
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, kind, filename: file.name, contentType, size: file.size }),
        });
        const data = (await res.json()) as { key?: string; url?: string; headers?: Record<string, string>; error?: string };
        if (!res.ok || !data.url || !data.key) throw new Error(data.error ?? "Couldn't start the upload.");

        const durationPromise = kind === "video" ? readVideoDuration(file) : Promise.resolve(undefined);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          xhr.open("PUT", data.url!);
          for (const [k, v] of Object.entries(data.headers ?? {})) xhr.setRequestHeader(k, v);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setState({ status: "uploading", progress: e.loaded / e.total, name: file.name });
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload failed (${xhr.status}). Check the storage bucket's CORS settings.`));
          xhr.onerror = () => reject(new Error("Upload failed. Check your connection, or the bucket's CORS settings."));
          xhr.onabort = () => reject(new Error("Upload cancelled."));
          xhr.send(file);
        });

        const done: UploadState = { status: "done", key: data.key, name: file.name, durationSeconds: await durationPromise };
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
