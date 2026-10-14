import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { driver, verifyLocalToken } from "@/lib/storage";
import { localPath } from "@/lib/storage/local";

// Development-only upload sink. In production files go straight to S3 via presigned URLs.
export async function PUT(request: Request) {
  if (driver() !== "local") return new Response("Not found", { status: 404 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  let key: string;
  try {
    ({ key } = await verifyLocalToken(token));
  } catch {
    return new Response("Upload link expired", { status: 403 });
  }
  if (!request.body) return new Response("Empty body", { status: 400 });
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await pipeline(Readable.fromWeb(request.body as WebReadableStream), createWriteStream(file));
  return new Response(null, { status: 200 });
}
