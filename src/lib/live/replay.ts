import "server-only";
import type { LiveSession } from "@/lib/db/schema";
import { fileUrl } from "@/lib/storage";
import { playbackTokens } from "./mux";
import type { Replay } from "./types";

export async function replayFor(s: LiveSession): Promise<Replay> {
  if (s.replayPlaybackId) {
    return { kind: "mux", playbackId: s.replayPlaybackId, tokens: await playbackTokens(s.replayPlaybackId, s.signedPlayback, false) };
  }
  if (s.recordingKeys.length) {
    const urls = (await Promise.all(s.recordingKeys.map((k) => fileUrl(k)))).filter((u): u is string => !!u);
    return urls.length ? { kind: "file", urls } : null;
  }
  return null;
}
