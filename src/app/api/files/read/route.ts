import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import mime from "./mime";
import { driver, verifyLocalToken } from "@/lib/storage";
import { localPath } from "@/lib/storage/local";

// Development-only file server with HTTP Range support so video seeking works.
export async function GET(request: Request) {
  if (driver() !== "local") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  let key: string;
  try {
    ({ key } = await verifyLocalToken(url.searchParams.get("token") ?? ""));
  } catch {
    return new Response("Link expired", { status: 403 });
  }
  const file = localPath(key);
  const info = await stat(file).catch(() => null);
  if (!info) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": mime(key),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });
  const dl = url.searchParams.get("dl");
  if (dl) headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(dl)}`);

  const range = request.headers.get("range");
  const match = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (match) {
    const start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
    if (start >= info.size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }
  headers.set("Content-Length", String(info.size));
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { status: 200, headers });
}
