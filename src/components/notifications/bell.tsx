"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Bell, BellRing, BookOpen, Megaphone, MessageSquare, Radio, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useCounters } from "@/components/realtime/counters";
import { useRealtime } from "@/components/realtime/provider";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notifications";
import type { NotificationKind } from "@/lib/db/schema";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { desktopAlertsEnabled, setDesktopAlerts } from "./desktop";

type Item = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  message: MessageSquare,
  live: Radio,
  announcement: Megaphone,
  lesson: BookOpen,
  certificate: Award,
  review: Star,
};

export function NotificationBell() {
  const router = useRouter();
  const { counters, refresh } = useCounters();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  // Only read inside the popover, which renders on the client after it opens.
  const [desktop, setDesktop] = useState(() => desktopAlertsEnabled());
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [, start] = useTransition();
  const unread = counters.notifications;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) setItems(((await res.json()) as { items: Item[] }).items);
    } catch {}
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void load();
  };

  useRealtime((m) => {
    if (open && (m.type === "notification" || m.type === "notifications.read")) void load();
  });

  const openItem = (item: Item) => {
    setOpen(false);
    if (!item.read) {
      setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, read: true } : i)) ?? null);
      start(async () => {
        await markNotificationReadAction(item.id);
        refresh();
      });
    }
    router.push(item.href);
  };

  const markAll = () => {
    setItems((list) => list?.map((i) => ({ ...i, read: true })) ?? null);
    start(async () => {
      await markAllNotificationsReadAction();
      refresh();
    });
  };

  const toggleDesktop = async (on: boolean) => {
    if (on && Notification.permission !== "granted") {
      const result = await Notification.requestPermission();
      if (result !== "granted") return;
    }
    setDesktopAlerts(on);
    setDesktop(on);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="relative rounded-full"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          {unread ? <BellRing className="size-[18px]" /> : <Bell className="size-[18px]" />}
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-heat px-1 font-mono text-[10px] font-semibold text-primary-foreground tabular-nums ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(380px,calc(100vw-2rem))] gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-medium">Notifications</h2>
          <Button variant="ghost" size="xs" onClick={markAll} disabled={!items?.some((i) => !i.read)}>
            Mark all read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto overscroll-contain">
          {items === null ? (
            <div className="space-y-3 p-4" aria-busy>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              You&apos;re all caught up. Replies, live classes and course updates will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {items.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none",
                        !item.read && "bg-ember/[0.04] shadow-[inset_2px_0_0_var(--ember)]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-background",
                          item.kind === "live" && "border-ember/50 text-ember-hot",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("line-clamp-1 text-sm", item.read ? "text-muted-foreground" : "font-medium text-foreground")}>
                          {item.title}
                        </span>
                        {item.body && <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</span>}
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {supported && (
          <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Desktop alerts when this tab is in the background</span>
            <Switch checked={desktop} onCheckedChange={(v) => void toggleDesktop(v)} aria-label="Desktop alerts" />
          </label>
        )}
      </PopoverContent>
    </Popover>
  );
}
