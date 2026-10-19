"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type RealtimeMessage = { topic: string; type: string; data: unknown };
type Handler = (message: RealtimeMessage) => void;
export type RealtimeStatus = "off" | "connecting" | "open" | "reconnecting";

type Ctx = { subscribe: (handler: Handler) => () => void; status: RealtimeStatus };
const RealtimeContext = createContext<Ctx>({ subscribe: () => () => {}, status: "off" });

/**
 * Opens an EventSource and keeps it open: the browser reconnects on network errors and
 * resumes from the last event id; we add backoff for hard failures (e.g. a deploy).
 */
export function openStream(url: string, onMessage: Handler, onStatus: (s: RealtimeStatus) => void) {
  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let lastId = "";
  let stopped = false;

  const connect = () => {
    if (stopped) return;
    const sep = url.includes("?") ? "&" : "?";
    source = new EventSource(lastId ? `${url}${sep}lastEventId=${encodeURIComponent(lastId)}` : url);
    source.onopen = () => {
      failures = 0;
      onStatus("open");
    };
    source.onmessage = (event) => {
      if (event.lastEventId) lastId = event.lastEventId;
      try {
        onMessage(JSON.parse(event.data) as RealtimeMessage);
      } catch {}
    };
    source.onerror = () => {
      onStatus("reconnecting");
      if (source?.readyState !== EventSource.CLOSED) return; // the browser is retrying
      source.close();
      failures += 1;
      // Signed out or gone: stop after a while, resume when the tab is focused again.
      if (failures > 8) return;
      retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** failures));
    };
  };

  const onFocus = () => {
    if (failures > 8 && source?.readyState === EventSource.CLOSED) {
      failures = 0;
      connect();
    }
  };

  onStatus("connecting");
  connect();
  window.addEventListener("focus", onFocus);
  return () => {
    stopped = true;
    clearTimeout(retry);
    window.removeEventListener("focus", onFocus);
    source?.close();
  };
}

export function RealtimeProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const handlers = useRef(new Set<Handler>());
  const [status, setStatus] = useState<RealtimeStatus>("off");

  useEffect(() => {
    if (!enabled) return;
    return openStream("/api/realtime", (m) => handlers.current.forEach((h) => h(m)), setStatus);
  }, [enabled]);

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);
  const value = useMemo<Ctx>(() => ({ subscribe, status: enabled ? status : "off" }), [subscribe, enabled, status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/** Run `handler` for every event on the signed-in user's connection. */
export function useRealtime(handler: Handler) {
  const { subscribe } = useContext(RealtimeContext);
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => subscribe((m) => ref.current(m)), [subscribe]);
}

export function useRealtimeStatus() {
  return useContext(RealtimeContext).status;
}

/** A dedicated stream for one live class (chat, reactions, viewer counts). */
export function useLiveChannel(sessionId: string, handler: Handler) {
  const ref = useRef(handler);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(
    () => openStream(`/api/realtime?live=${sessionId}`, (m) => ref.current(m), setStatus),
    [sessionId],
  );
  return status;
}
