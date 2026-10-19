"use client";

import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useRealtime } from "@/components/realtime/provider";
import { isThreadActive } from "@/lib/active-thread";
import { desktopAlert } from "./desktop";

type Payload = { title: string; body?: string; href: string; kind: string; groupKey?: string | null };

/** Pops a toast (and an OS alert when the tab is hidden) for each new notification. */
export function NotificationToasts() {
  const router = useRouter();
  const pathname = usePathname();

  useRealtime((m) => {
    if (m.type !== "notification") return;
    const n = m.data as Payload;
    if (isThreadActive(n.groupKey) || pathname === n.href) return;
    const body = n.body ?? "";
    const liveNow = n.kind === "live" && n.title.startsWith("Live now");
    desktopAlert(n.title, body, n.href);
    toast(n.title, {
      id: n.groupKey ?? undefined,
      description: body.length > 140 ? `${body.slice(0, 139)}…` : body || undefined,
      duration: liveNow ? 15000 : 6000,
      action: { label: liveNow ? "Join" : "Open", onClick: () => router.push(n.href) },
    });
  });

  return null;
}
