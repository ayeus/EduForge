"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "./provider";

/** Re-render the current server page when any of these realtime events arrive. */
export function RefreshOn({ types }: { types: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useRealtime((m) => {
    if (!types.includes(m.type)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 500);
  });
  return null;
}
