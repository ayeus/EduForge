import "server-only";
import Mux from "@mux/ts";
import type { PlayerTokens } from "./mux-types";

export type { PlayerTokens };

/** RTMPS works with OBS, Streamlabs, Zoom and most mobile encoders. */
export const RTMP_SERVER_URL = "rtmps://global-live.mux.com:443/app";
/** Plain RTMP on Mux's port 5222, for encoders without TLS support. */
export const RTMP_SERVER_URL_PLAIN = "rtmp://global-live.mux.com:5222/app";

export function muxConfigured() {
  return !!(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

/** Signed playback keeps streams private to enrolled students. Needs a Mux signing key. */
export function signedPlaybackConfigured() {
  return !!(process.env.MUX_SIGNING_KEY && process.env.MUX_PRIVATE_KEY);
}

export class MuxNotConfiguredError extends Error {
  constructor() {
    super("Live streaming isn't set up yet. Add MUX_TOKEN_ID and MUX_TOKEN_SECRET.");
  }
}

let client: Mux | undefined;
export function mux() {
  if (!muxConfigured()) throw new MuxNotConfiguredError();
  return (client ??= new Mux());
}

export async function createLiveStream(sessionId: string) {
  const signed = signedPlaybackConfigured();
  const policy = signed ? "signed" : "public";
  const stream = await mux().video.liveStreams.create({
    playback_policies: [policy],
    new_asset_settings: { playback_policies: [policy] },
    latency_mode: "low",
    // Low-latency streams default to no reconnect window; give flaky connections a minute.
    reconnect_window: 60,
    passthrough: sessionId,
    // Free, watermarked, 5-minute streams for trying things out.
    test: process.env.MUX_TEST_STREAMS === "true" || undefined,
  });
  return {
    id: stream.id,
    streamKey: stream.stream_key,
    playbackId: stream.playback_ids?.[0]?.id ?? null,
    signed,
  };
}

/** Short-lived tokens for a signed playback id, in the shape Mux Player expects. */
export async function playbackTokens(playbackId: string, signed: boolean, live: boolean): Promise<PlayerTokens | undefined> {
  if (!signed || !signedPlaybackConfigured()) return undefined;
  const sign = (type: "video" | "thumbnail" | "storyboard") =>
    mux().jwt.signPlaybackId(playbackId, { type, expiration: "6h" });
  const [playback, thumbnail, storyboard] = await Promise.all([
    sign("video"),
    sign("thumbnail"),
    live ? Promise.resolve(undefined) : sign("storyboard"),
  ]);
  return { playback, thumbnail, storyboard };
}
