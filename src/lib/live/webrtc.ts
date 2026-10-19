import "server-only";

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

/**
 * STUN finds a direct path between the host and each viewer. Some networks (strict NATs,
 * corporate firewalls) also need a TURN relay; set TURN_URL, TURN_USERNAME and TURN_CREDENTIAL.
 */
export function iceServers(): IceServer[] {
  const servers: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turn = (process.env.TURN_URL ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (turn.length) {
    servers.push({
      urls: turn,
      username: process.env.TURN_USERNAME || undefined,
      credential: process.env.TURN_CREDENTIAL || undefined,
    });
  }
  return servers;
}

/** Browser broadcasts send one stream per viewer, so they suit classes up to this size. */
export function maxBrowserViewers() {
  return Number(process.env.LIVE_MAX_BROWSER_VIEWERS) || 30;
}
