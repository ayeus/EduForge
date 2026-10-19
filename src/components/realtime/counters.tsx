"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRealtime } from "./provider";

export type Counters = { messages: number; notifications: number };

const EMPTY: Counters = { messages: 0, notifications: 0 };
const CountersContext = createContext<{ counters: Counters; refresh: () => void }>({ counters: EMPTY, refresh: () => {} });
const REFRESH_ON = new Set(["message", "thread.read", "notification", "notifications.read"]);

/** Header badge counts, seeded by the server and kept fresh by realtime events. */
export function CountersProvider({ initial, children }: { initial: Counters | null; children: React.ReactNode }) {
  const [counters, setCounters] = useState<Counters>(initial ?? EMPTY);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enabled = initial !== null;

  // Adopt fresh server counts (e.g. after signing in) without an effect.
  const key = initial ? `${initial.messages}:${initial.notifications}` : "";
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setCounters(initial ?? EMPTY);
  }

  const refresh = useCallback(() => {
    if (!enabled) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/me/counters", { cache: "no-store" });
        if (res.ok) setCounters((await res.json()) as Counters);
      } catch {}
    }, 250);
  }, [enabled]);

  useRealtime((m) => {
    if (REFRESH_ON.has(m.type)) refresh();
  });

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return <CountersContext.Provider value={{ counters, refresh }}>{children}</CountersContext.Provider>;
}

export function useCounters() {
  return useContext(CountersContext);
}

/** Small count pill for nav items. Renders nothing at zero. */
export function CountBadge({ kind, className }: { kind: keyof Counters; className?: string }) {
  const n = useCounters().counters[kind];
  if (!n) return null;
  return (
    <span
      className={`grid h-[18px] min-w-[18px] place-items-center rounded-full bg-heat px-1 font-mono text-[10px] leading-none font-semibold text-primary-foreground tabular-nums ${className ?? ""}`}
    >
      {n > 99 ? "99+" : n}
      <span className="sr-only"> unread</span>
    </span>
  );
}
