import type { PlayerTokens } from "./mux-types";

/** What a finished class can be replayed from: Mux's recording, or segments recorded in the host's browser. */
export type Replay = { kind: "mux"; playbackId: string; tokens?: PlayerTokens } | { kind: "file"; urls: string[] } | null;
