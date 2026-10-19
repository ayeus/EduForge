import { createSignalSender, randomId, type IceServerConfig, type SignalEnvelope, type ToHost } from "./signals";

type Conn = {
  key: string;
  userId: string;
  clientId: string;
  name: string;
  pc: RTCPeerConnection;
  video: RTCRtpSender;
  audio: RTCRtpSender;
  pendingIce: RTCIceCandidateInit[];
  connected: boolean;
};

export type ViewerInfo = { key: string; name: string; connected: boolean };

/** Lower each stream's quality as the class grows, since the host uploads one copy per viewer. */
function encodingFor(viewers: number) {
  if (viewers <= 4) return { maxBitrate: 1_500_000, scaleResolutionDownBy: 1 };
  if (viewers <= 10) return { maxBitrate: 900_000, scaleResolutionDownBy: 1 };
  if (viewers <= 20) return { maxBitrate: 600_000, scaleResolutionDownBy: 1.5 };
  return { maxBitrate: 400_000, scaleResolutionDownBy: 2 };
}

/**
 * The host side of a browser broadcast: one peer connection per viewer tab, all fed from
 * the same camera/screen and microphone tracks. Tracks can be swapped (camera ↔ screen)
 * without renegotiating.
 */
export class Broadcaster {
  private conns = new Map<string, Conn>();
  private signals: ReturnType<typeof createSignalSender>;
  private epoch = randomId();
  private stream = new MediaStream();
  private videoTrack: MediaStreamTrack | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private active = false;

  private iceServers: IceServerConfig[];
  private maxViewers: number;
  private onViewers: (viewers: ViewerInfo[]) => void;

  constructor(sessionId: string, iceServers: IceServerConfig[], maxViewers: number, onViewers: (viewers: ViewerInfo[]) => void) {
    this.signals = createSignalSender(sessionId);
    this.iceServers = iceServers;
    this.maxViewers = maxViewers;
    this.onViewers = onViewers;
  }

  get isActive() {
    return this.active;
  }

  setTracks(video: MediaStreamTrack | null, audio: MediaStreamTrack | null) {
    for (const t of this.stream.getTracks()) this.stream.removeTrack(t);
    if (video) this.stream.addTrack(video);
    if (audio) this.stream.addTrack(audio);
    this.videoTrack = video;
    this.audioTrack = audio;
    for (const c of this.conns.values()) {
      void c.video.replaceTrack(video).catch(() => {});
      void c.audio.replaceTrack(audio).catch(() => {});
    }
  }

  start() {
    this.active = true;
    this.epoch = randomId();
  }

  /** Tell every viewer the broadcast is over and close all connections. */
  stop() {
    for (const c of this.conns.values()) {
      this.signals.send(c.userId, { dir: "toViewer", kind: "bye", clientId: c.clientId }, { now: true });
      c.pc.close();
    }
    this.conns.clear();
    this.active = false;
    this.emit();
  }

  handle(envelope: SignalEnvelope) {
    if (!this.active) return;
    for (const m of envelope.messages) {
      if (m.dir !== "toHost") continue;
      void this.onMessage(envelope.from, envelope.fromName, m);
    }
  }

  private emit() {
    this.onViewers([...this.conns.values()].map((c) => ({ key: c.key, name: c.name, connected: c.connected })));
  }

  private applyEncoding() {
    const enc = encodingFor(this.conns.size);
    for (const c of this.conns.values()) {
      const params = c.video.getParameters();
      if (!params.encodings?.length) continue;
      params.encodings[0] = { ...params.encodings[0], ...enc };
      void c.video.setParameters(params).catch(() => {});
    }
  }

  private close(key: string) {
    const c = this.conns.get(key);
    if (!c) return;
    c.pc.close();
    this.conns.delete(key);
    this.emit();
    this.applyEncoding();
  }

  private async onMessage(userId: string, name: string, m: ToHost) {
    const key = `${userId}:${m.clientId}`;
    if (m.kind === "join") return this.connect(userId, name, m.clientId, key);
    if (m.kind === "leave") return this.close(key);
    const c = this.conns.get(key);
    if (!c || m.epoch !== this.epoch) return;
    if (m.kind === "answer") {
      if (c.pc.signalingState !== "have-local-offer") return;
      await c.pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
      for (const cand of c.pendingIce.splice(0)) await c.pc.addIceCandidate(cand).catch(() => {});
      this.applyEncoding();
    } else if (m.kind === "ice") {
      if (c.pc.remoteDescription) await c.pc.addIceCandidate(m.candidate).catch(() => {});
      else c.pendingIce.push(m.candidate);
    }
  }

  private async connect(userId: string, name: string, clientId: string, key: string) {
    if (!this.conns.has(key) && this.conns.size >= this.maxViewers) {
      this.signals.send(userId, { dir: "toViewer", kind: "full", clientId });
      return;
    }
    this.close(key);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const video = pc.addTransceiver(this.videoTrack ?? "video", { direction: "sendonly", streams: [this.stream] }).sender;
    const audio = pc.addTransceiver(this.audioTrack ?? "audio", { direction: "sendonly", streams: [this.stream] }).sender;
    const conn: Conn = { key, userId, clientId, name, pc, video, audio, pendingIce: [], connected: false };
    this.conns.set(key, conn);
    const epoch = this.epoch;

    pc.onicecandidate = (e) => {
      if (e.candidate) this.signals.send(userId, { dir: "toViewer", kind: "ice", clientId, epoch, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (this.conns.get(key) !== conn) return;
      if (pc.connectionState === "connected") {
        conn.connected = true;
        this.emit();
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.close(key);
      }
    };
    this.emit();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signals.send(userId, { dir: "toViewer", kind: "offer", clientId, epoch, sdp: pc.localDescription!.sdp }, { now: true });
  }
}
