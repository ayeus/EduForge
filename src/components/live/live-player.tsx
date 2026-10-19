"use client";

import MuxPlayer from "@mux/mux-player-react/lazy";
import type { PlayerTokens } from "@/lib/live/mux-types";

/** Mux Player themed for EduForge. `live` switches to the low-latency live UI. */
export function LivePlayer({
  playbackId,
  tokens,
  live,
  title,
  viewerId,
}: {
  playbackId: string;
  tokens?: PlayerTokens;
  live: boolean;
  title: string;
  viewerId: string;
}) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      tokens={tokens}
      streamType={live ? "live" : "on-demand"}
      autoPlay={live ? "muted" : false}
      title={title}
      metadata={{ video_title: title, viewer_user_id: viewerId }}
      accentColor="#ff7a2f"
      primaryColor="#e6eaf7"
      secondaryColor="rgba(9, 13, 31, 0.72)"
      loading="viewport"
      style={{ aspectRatio: "16 / 9", width: "100%", display: "block", borderRadius: "inherit", overflow: "hidden" }}
    />
  );
}
