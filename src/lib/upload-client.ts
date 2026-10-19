export type UploadKind = "video" | "attachment" | "cover";

/**
 * Uploads a file or blob straight to storage through a presigned URL, reporting progress.
 * Returns the storage key. Throws with a readable message on failure.
 */
export async function uploadToStorage({
  courseId,
  kind,
  body,
  filename,
  contentType,
  onProgress,
  onXhr,
}: {
  courseId: string;
  kind: UploadKind;
  body: Blob;
  filename: string;
  contentType: string;
  onProgress?: (fraction: number) => void;
  onXhr?: (xhr: XMLHttpRequest) => void;
}) {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseId, kind, filename, contentType, size: body.size }),
  });
  const data = (await res.json().catch(() => ({}))) as { key?: string; url?: string; headers?: Record<string, string>; error?: string };
  if (!res.ok || !data.url || !data.key) throw new Error(data.error ?? "Couldn't start the upload.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onXhr?.(xhr);
    xhr.open("PUT", data.url!);
    for (const [k, v] of Object.entries(data.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). Check the storage bucket's CORS settings.`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection, or the bucket's CORS settings."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(body);
  });
  return data.key;
}
