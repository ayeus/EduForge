import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export type UploadKind = "video" | "attachment" | "cover";

export const UPLOAD_RULES: Record<UploadKind, { maxBytes: number; types: RegExp; label: string }> = {
  video: { maxBytes: 2 * 1024 ** 3, types: /^video\/(mp4|webm|ogg|quicktime)$/, label: "MP4, WebM, OGG or MOV up to 2 GB" },
  attachment: {
    maxBytes: 100 * 1024 ** 2,
    types:
      /^(application\/(pdf|zip|x-zip-compressed|vnd\.openxmlformats-officedocument\.(presentationml\.presentation|wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-powerpoint|msword)|text\/(plain|markdown|csv))$/,
    label: "PDF, slides, docs, sheets, ZIP or text up to 100 MB",
  },
  cover: { maxBytes: 5 * 1024 ** 2, types: /^image\/(png|jpeg|webp|avif)$/, label: "PNG, JPEG, WebP or AVIF up to 5 MB" },
};

export function driver(): "s3" | "local" {
  const explicit = process.env.STORAGE_DRIVER;
  if (explicit === "local" || explicit === "s3") return explicit;
  return process.env.S3_BUCKET_NAME ? "s3" : "local";
}

export function buildKey(courseId: string, kind: UploadKind, filename: string) {
  const safe = filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return `courses/${courseId}/${kind}/${randomUUID()}-${safe}`;
}

export function keyBelongsTo(key: string, courseId: string) {
  return key.startsWith(`courses/${courseId}/`) && !key.includes("..");
}

function localKey() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

export async function signLocalToken(key: string, contentType: string, ttl = "1h") {
  return new SignJWT({ key, ct: contentType })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(ttl)
    .sign(localKey());
}

export async function verifyLocalToken(token: string) {
  const { payload } = await jwtVerify(token, localKey());
  return payload as { key: string; ct: string };
}

export type UploadTarget = { url: string; method: "PUT"; headers: Record<string, string> };

export async function createUploadTarget(key: string, contentType: string): Promise<UploadTarget> {
  if (driver() === "s3") {
    const { presignPut } = await import("./s3");
    return { url: await presignPut(key, contentType), method: "PUT", headers: { "Content-Type": contentType } };
  }
  const token = await signLocalToken(key, contentType);
  return {
    url: `/api/files/upload?token=${encodeURIComponent(token)}`,
    method: "PUT",
    headers: { "Content-Type": contentType },
  };
}

/** Short-lived URL to read an object. Works with private buckets. */
export async function fileUrl(key: string | null | undefined, opts: { downloadName?: string } = {}) {
  if (!key) return null;
  if (driver() === "s3") {
    const { presignGet } = await import("./s3");
    return presignGet(key, opts.downloadName);
  }
  const token = await signLocalToken(key, "", "6h");
  const dl = opts.downloadName ? `&dl=${encodeURIComponent(opts.downloadName)}` : "";
  return `/api/files/read?token=${encodeURIComponent(token)}${dl}`;
}

export async function deleteFile(key: string | null | undefined) {
  if (!key) return;
  try {
    if (driver() === "s3") {
      const { deleteObject } = await import("./s3");
      await deleteObject(key);
    } else {
      const { unlink } = await import("node:fs/promises");
      const { localPath } = await import("./local");
      await unlink(localPath(key));
    }
  } catch (err) {
    console.warn("[storage] delete failed", key, err);
  }
}
