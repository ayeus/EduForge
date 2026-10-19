"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useHydrated } from "@/components/local-time";
import { useRealtime } from "@/components/realtime/provider";
import { initials, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ConversationRow = {
  href: string;
  name: string;
  context: string;
  lastAt: string | null;
  lastBody: string | null;
  unread: number;
  lastSeenAt: string | null;
};

/** Conversation list for the inbox and the student's messages. Re-sorts itself as messages arrive. */
export function ConversationList({ rows, empty, rootHref }: { rows: ConversationRow[]; empty: React.ReactNode; rootHref: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const inThread = pathname !== rootHref;
  const hydrated = useHydrated();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useRealtime((m) => {
    if (m.type !== "message" && m.type !== "thread.read") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  });

  if (!rows.length) {
    return (
      <div className={cn("self-start rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground", inThread && "hidden md:block")}>
        {empty}
      </div>
    );
  }

  return (
    <nav aria-label="Conversations" className={cn("min-w-0 self-start", inThread && "hidden md:block")}>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((t) => {
          const active = pathname === t.href;
          const online = hydrated && !!t.lastSeenAt && now - new Date(t.lastSeenAt).getTime() < 2 * 60_000;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/50",
                  active && "bg-secondary shadow-[inset_2px_0_0_var(--ember)]",
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  <span className="grid size-9 place-items-center rounded-full border border-border bg-background font-display text-[11px]">
                    {initials(t.name)}
                  </span>
                  <span
                    className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card", online ? "bg-emerald-400" : "bg-transparent")}
                    aria-label={online ? "Online" : undefined}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.name}</span>
                    {t.lastAt && hydrated && <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(t.lastAt)}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{t.context}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-sm", t.unread ? "text-foreground" : "text-muted-foreground")}>
                      {t.lastBody ?? "No messages yet"}
                    </span>
                    {t.unread > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-heat px-1.5 font-mono text-[11px] text-primary-foreground">
                        {t.unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
