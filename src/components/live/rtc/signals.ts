/**
 * Signalling messages for browser broadcasts. They ride the class's realtime channel:
 * viewers post to "host", the host posts to a viewer's user id. `clientId` identifies one
 * browser tab, so the same person can watch in two tabs (or a host can preview their own class).
 */
export type IceServerConfig = { urls: string | string[]; username?: string; credential?: string };

export type ToHost =
  | { dir: "toHost"; kind: "join"; clientId: string }
  | { dir: "toHost"; kind: "leave"; clientId: string }
  | { dir: "toHost"; kind: "answer"; clientId: string; epoch: string; sdp: string }
  | { dir: "toHost"; kind: "ice"; clientId: string; epoch: string; candidate: RTCIceCandidateInit };

export type ToViewer =
  | { dir: "toViewer"; kind: "offer"; clientId: string; epoch: string; sdp: string }
  | { dir: "toViewer"; kind: "ice"; clientId: string; epoch: string; candidate: RTCIceCandidateInit }
  | { dir: "toViewer"; kind: "full"; clientId: string }
  | { dir: "toViewer"; kind: "bye"; clientId: string };

export type SignalMessage = ToHost | ToViewer;

/** What arrives on the realtime channel for a `live.signal` event. */
export type SignalEnvelope = { sessionId: string; from: string; fromName: string; messages: SignalMessage[] };

/**
 * Batches messages per recipient for a few milliseconds (ICE candidates come in bursts)
 * and posts them to the signalling endpoint. Returns false when the post was rejected.
 */
export function createSignalSender(sessionId: string) {
  const queues = new Map<string, SignalMessage[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onRejected: ((status: number) => void) | undefined;

  const flush = async () => {
    timer = undefined;
    const batches = [...queues.entries()];
    queues.clear();
    await Promise.all(
      batches.map(async ([to, messages]) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await fetch(`/api/live/${sessionId}/signal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to, messages }),
              keepalive: messages.some((m) => m.kind === "leave" || m.kind === "bye"),
            });
            if (res.ok) return;
            if (res.status !== 429) {
              onRejected?.(res.status);
              return;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 400));
        }
      }),
    );
  };

  return {
    send(to: string, message: SignalMessage, { now = false } = {}) {
      const q = queues.get(to) ?? [];
      q.push(message);
      queues.set(to, q);
      if (now) {
        clearTimeout(timer);
        void flush();
      } else {
        timer ??= setTimeout(() => void flush(), 40);
      }
    },
    onRejected(fn: (status: number) => void) {
      onRejected = fn;
    },
  };
}

export function randomId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
