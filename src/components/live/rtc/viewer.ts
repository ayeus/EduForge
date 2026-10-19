import { createSignalSender, randomId, type IceServerConfig, type SignalEnvelope } from "./signals";

export type ViewerState = "idle" | "connecting" | "live" | "reconnecting" | "full";

/**
 * The student side of a browser broadcast. Asks the host for a connection, answers the host's
 * offer, and keeps retrying (with backoff) through network blips or a host reload.
 */
export class Viewer {
  private pc: RTCPeerConnection | null = null;
  private epoch: string | null = null;
  private iceByEpoch = new Map<string, RTCIceCandidateInit[]>();
  private clientId = randomId();
  private signals: ReturnType<typeof createSignalSender>;
  private offerTimer: ReturnType<typeof setTimeout> | undefined;
  private disconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  private connected = false;
  private wanted = false;
  private iceServers: IceServerConfig[];
  private onState: (s: ViewerState) => void;
  private onStream: (s: MediaStream | null) => void;

  constructor(
    sessionId: string,
    iceServers: IceServerConfig[],
    onState: (s: ViewerState) => void,
    onStream: (s: MediaStream | null) => void,
  ) {
    this.signals = createSignalSender(sessionId);
    this.iceServers = iceServers;
    this.onState = onState;
    this.onStream = onStream;
  }

  start() {
    this.wanted = true;
    this.join();
  }

  stop() {
    this.wanted = false;
    clearTimeout(this.offerTimer);
    clearTimeout(this.disconnectTimer);
    if (this.pc) {
      this.signals.send("host", { dir: "toHost", kind: "leave", clientId: this.clientId }, { now: true });
      this.closePc();
    }
    this.onStream(null);
    this.onState("idle");
  }

  /** The host (re)started broadcasting: connect from scratch. */
  rejoin() {
    if (!this.wanted) return;
    this.closePc();
    this.attempts = 0;
    this.join();
  }

  handle(envelope: SignalEnvelope) {
    if (!this.wanted) return;
    for (const m of envelope.messages) {
      if (m.dir !== "toViewer" || m.clientId !== this.clientId) continue;
      if (m.kind === "offer") void this.onOffer(m.epoch, m.sdp);
      else if (m.kind === "ice") {
        if (this.pc && this.epoch === m.epoch && this.pc.remoteDescription) {
          void this.pc.addIceCandidate(m.candidate).catch(() => {});
        } else {
          const q = this.iceByEpoch.get(m.epoch) ?? [];
          q.push(m.candidate);
          this.iceByEpoch.set(m.epoch, q);
        }
      } else if (m.kind === "full") {
        clearTimeout(this.offerTimer);
        this.closePc();
        this.onState("full");
      } else if (m.kind === "bye") {
        this.closePc();
        this.onStream(null);
        this.onState("reconnecting");
        // The host may be reloading; ask again shortly.
        clearTimeout(this.offerTimer);
        this.offerTimer = setTimeout(() => this.join(), 3000);
      }
    }
  }

  private closePc() {
    clearTimeout(this.disconnectTimer);
    this.connected = false;
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
  }

  private join() {
    if (!this.wanted) return;
    clearTimeout(this.offerTimer);
    this.onState(this.attempts > 0 ? "reconnecting" : "connecting");
    this.signals.send("host", { dir: "toHost", kind: "join", clientId: this.clientId }, { now: true });
    // No offer yet (host not ready, message lost): ask again, backing off up to 10s.
    const wait = Math.min(10_000, 2500 * 2 ** Math.min(this.attempts, 2));
    this.attempts += 1;
    this.offerTimer = setTimeout(() => {
      if (this.wanted && !this.connected) this.join();
    }, wait);
  }

  private async onOffer(epoch: string, sdp: string) {
    this.closePc();
    this.epoch = epoch;
    // Watchdog: if this negotiation never connects, start over.
    clearTimeout(this.offerTimer);
    this.offerTimer = setTimeout(() => {
      if (this.wanted && !this.connected) this.join();
    }, 12_000);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc = pc;
    pc.ontrack = (e) => {
      if (this.pc === pc) this.onStream(e.streams[0] ?? new MediaStream([e.track]));
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signals.send("host", { dir: "toHost", kind: "ice", clientId: this.clientId, epoch, candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      const state = pc.connectionState;
      if (state === "connected") {
        this.connected = true;
        this.attempts = 0;
        clearTimeout(this.offerTimer);
        clearTimeout(this.disconnectTimer);
        this.onState("live");
      } else if (state === "disconnected") {
        this.onState("reconnecting");
        clearTimeout(this.disconnectTimer);
        this.disconnectTimer = setTimeout(() => {
          if (this.pc === pc && pc.connectionState !== "connected") this.rejoin();
        }, 4000);
      } else if (state === "failed") {
        this.onState("reconnecting");
        this.closePc();
        clearTimeout(this.offerTimer);
        this.offerTimer = setTimeout(() => this.join(), 1000);
      }
    };

    try {
      await pc.setRemoteDescription({ type: "offer", sdp });
      const queued = this.iceByEpoch.get(epoch) ?? [];
      this.iceByEpoch.clear();
      for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.signals.send(
        "host",
        { dir: "toHost", kind: "answer", clientId: this.clientId, epoch, sdp: pc.localDescription!.sdp },
        { now: true },
      );
    } catch {
      if (this.pc === pc) {
        this.closePc();
        this.offerTimer = setTimeout(() => this.join(), 1500);
      }
    }
  }
}
