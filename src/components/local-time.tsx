"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};
/** True after hydration, so times render in the viewer's timezone without a mismatch. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

const FORMATS = {
  full: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  date: { weekday: "long", month: "long", day: "numeric" },
  time: { hour: "numeric", minute: "2-digit", timeZoneName: "short" },
  short: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  dayNum: { day: "numeric" },
  month: { month: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export function LocalTime({ iso, format = "full", className }: { iso: string; format?: keyof typeof FORMATS; className?: string }) {
  const hydrated = useHydrated();
  return (
    <time dateTime={iso} className={className}>
      {hydrated ? new Intl.DateTimeFormat(undefined, FORMATS[format]).format(new Date(iso)) : " "}
    </time>
  );
}

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Ticking countdown to `iso`. Shows `fallback` once the moment has passed. */
export function Countdown({ iso, fallback, className }: { iso: string; fallback: React.ReactNode; className?: string }) {
  const hydrated = useHydrated();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!hydrated) return <span className={className}>{" "}</span>;
  const left = new Date(iso).getTime() - now;
  if (left <= 0) return <span className={className}>{fallback}</span>;
  const { d, h, m, s } = parts(left);
  return (
    <span className={className} role="timer" aria-label={`Starts in ${d ? `${d} days ` : ""}${h} hours ${m} minutes`}>
      {d > 0 && <>{d}d </>}
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
