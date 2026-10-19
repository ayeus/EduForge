"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/components/local-time";
import { useRealtime, useRealtimeStatus } from "@/components/realtime/provider";
import { setThreadActive, threadKey } from "@/lib/active-thread";
import { markThreadReadAction, sendMessageAction, typingAction } from "@/lib/actions/messages";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  senderId: string;
  senderName: string;
  pending?: boolean;
};

export type ThreadPeer = { id: string; name: string; lastSeenAt: string | null; subtitle?: string };

type MessageEvent = { courseId: string; studentId: string; message: ThreadMessage };
type TypingEvent = { courseId: string; studentId: string; userId: string };
type ReadEvent = { courseId: string; studentId: string; readerId: string; readAt: string };

const ONLINE_MS = 2 * 60_000;
const TYPING_SEND_MS = 2500;
const TYPING_SHOW_MS = 4000;

function presence(lastSeenAt: string | null, now: number) {
  if (!lastSeenAt) return { online: false, label: "Offline" };
  const diff = now - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_MS) return { online: true, label: "Online" };
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return { online: false, label: `Active ${mins}m ago` };
  const hours = Math.round(mins / 60);
  if (hours < 24) return { online: false, label: `Active ${hours}h ago` };
  return { online: false, label: `Active ${Math.round(hours / 24)}d ago` };
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return dayFmt.format(d);
}

export function Thread({
  courseId,
  studentId,
  viewerId,
  peer: initialPeer,
  initial,
  emptyText,
  placeholder,
  className,
  active = true,
}: {
  courseId: string;
  studentId: string;
  viewerId: string;
  peer: ThreadPeer;
  initial: ThreadMessage[];
  emptyText: string;
  placeholder: string;
  className?: string;
  /** False while the thread is mounted but hidden (e.g. an inactive tab): no read receipts, toasts still show. */
  active?: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [peerSeenAt, setPeerSeenAt] = useState(initialPeer.lastSeenAt);
  const [peerTyping, setPeerTyping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [atBottom, setAtBottom] = useState(true);
  const [unseenBelow, setUnseenBelow] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTypingSent = useRef(0);
  const readTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const status = useRealtimeStatus();
  // Times and presence depend on the viewer's clock and locale, so they render after hydration.
  const hydrated = useHydrated();
  const key = threadKey(courseId, studentId);
  const matches = (e: { courseId: string; studentId: string }) => e.courseId === courseId && e.studentId === studentId;

  // Tell the notification layer this thread is on screen.
  useEffect(() => {
    if (!active) return;
    setThreadActive(key, true);
    return () => setThreadActive(key, false);
  }, [key, active]);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const scrollDom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  const scrollToBottom = useCallback(
    (smooth = false) => {
      scrollDom(smooth);
      setUnseenBelow(0);
    },
    [scrollDom],
  );

  const markRead = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (activeRef.current && document.visibilityState === "visible") void markThreadReadAction(courseId, studentId);
    }, 300);
  }, [courseId, studentId]);

  useEffect(() => {
    if (!active) return;
    scrollDom();
    markRead();
    const onVisible = () => document.visibilityState === "visible" && markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active, scrollDom, markRead]);

  const addMessage = useCallback(
    (m: ThreadMessage) => {
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
      const mine = m.senderId === viewerId;
      if (mine || atBottom) requestAnimationFrame(() => scrollToBottom(true));
      else setUnseenBelow((n) => n + 1);
      if (!mine) markRead();
    },
    [viewerId, atBottom, scrollToBottom, markRead],
  );

  useRealtime((m) => {
    if (m.type === "message") {
      const e = m.data as MessageEvent;
      if (!matches(e)) return;
      if (e.message.senderId !== viewerId) {
        setPeerTyping(false);
        setPeerSeenAt(new Date().toISOString());
      }
      addMessage(e.message);
    } else if (m.type === "typing") {
      const e = m.data as TypingEvent;
      if (!matches(e) || e.userId === viewerId) return;
      setPeerTyping(true);
      setPeerSeenAt(new Date().toISOString());
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setPeerTyping(false), TYPING_SHOW_MS);
    } else if (m.type === "thread.read") {
      const e = m.data as ReadEvent;
      if (!matches(e) || e.readerId === viewerId) return;
      setPeerSeenAt(new Date().toISOString());
      setMessages((list) =>
        list.map((x) => (x.senderId === viewerId && !x.readAt && x.createdAt <= e.readAt ? { ...x, readAt: e.readAt } : x)),
      );
    }
  });

  // Without a live connection, fall back to polling so nothing is missed.
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/threads/${courseId}/${studentId}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { messages: ThreadMessage[] };
    setMessages((list) => {
      const pending = list.filter((x) => x.pending);
      return [...data.messages, ...pending];
    });
  }, [courseId, studentId]);

  useEffect(() => {
    if (status === "open") return;
    const t = setInterval(() => document.visibilityState === "visible" && void refresh(), 8000);
    return () => clearInterval(t);
  }, [status, refresh]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(bottom);
    if (bottom) setUnseenBelow(0);
  };

  const onDraft = (value: string) => {
    setDraft(value);
    if (value.trim() && Date.now() - lastTypingSent.current > TYPING_SEND_MS) {
      lastTypingSent.current = Date.now();
      void typingAction(courseId, studentId);
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ThreadMessage = {
      id: tempId,
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
      senderId: viewerId,
      senderName: "You",
      pending: true,
    };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    lastTypingSent.current = 0;
    requestAnimationFrame(() => scrollToBottom(true));
    void (async () => {
      const res = await sendMessageAction(courseId, studentId, body);
      if ("error" in res) {
        toast.error(res.error);
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setDraft(body);
        return;
      }
      // The realtime echo may have landed first; keep exactly one copy.
      setMessages((list) =>
        list.some((x) => x.id === res.message.id)
          ? list.filter((x) => x.id !== tempId)
          : list.map((x) => (x.id === tempId ? res.message : x)),
      );
    })();
  };

  const p = presence(peerSeenAt, now);
  const lastMineSeen = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId === viewerId && m.readAt) return m.id;
    }
    return null;
  }, [messages, viewerId]);

  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="relative">
          <span className="grid size-9 place-items-center rounded-full border border-border bg-secondary font-display text-[11px]">
            {initials(initialPeer.name)}
          </span>
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card",
              hydrated && p.online ? "bg-emerald-400" : "bg-muted-foreground/40",
            )}
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{initialPeer.name}</div>
          <div className="truncate text-xs text-muted-foreground" aria-live="polite">
            {peerTyping ? (
              <span className="text-ember-hot">typing…</span>
            ) : (
              [hydrated ? p.label : null, initialPeer.subtitle].filter(Boolean).join(" · ") || "\u00a0"
            )}
          </div>
        </div>
        {status !== "open" && status !== "off" && (
          <span className="text-[11px] text-muted-foreground" title="Live updates are reconnecting; messages still send.">
            Reconnecting…
          </span>
        )}
      </div>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="max-h-[min(60vh,520px)] min-h-[240px] flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        aria-live="polite"
        aria-label={`Conversation with ${initialPeer.name}`}
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-balance text-muted-foreground">{emptyText}</p>
        ) : (
          <ol className="space-y-1">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const mine = m.senderId === viewerId;
              const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
              const groupedWithNext =
                next && next.senderId === m.senderId && new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() < 5 * 60_000;
              return (
                <li key={m.id}>
                  {newDay && (
                    <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      {hydrated ? dayLabel(m.createdAt) : "\u00a0"}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div className={cn("flex flex-col", mine ? "items-end" : "items-start", !groupedWithNext && "mb-3")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
                        mine ? "bg-ember/15 ring-1 ring-ember/30" : "bg-secondary",
                        mine && !groupedWithNext && "rounded-br-md",
                        !mine && !groupedWithNext && "rounded-bl-md",
                        m.pending && "opacity-70",
                      )}
                    >
                      {m.body}
                    </div>
                    {!groupedWithNext && (
                      <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                        {hydrated ? timeFmt.format(new Date(m.createdAt)) : "\u00a0"}
                        {mine &&
                          (m.pending ? (
                            <span>· Sending</span>
                          ) : m.id === lastMineSeen ? (
                            <span className="inline-flex items-center gap-0.5 text-ember-hot"><CheckCheck className="size-3" /> Seen</span>
                          ) : !m.readAt ? (
                            <Check className="size-3" aria-label="Delivered" />
                          ) : null)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {peerTyping && (
          <div className="mt-1 flex items-center gap-1 px-1" aria-hidden>
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70"
                style={{ animationDelay: `${d * 120}ms` }}
              />
            ))}
          </div>
        )}
      </div>

      {unseenBelow > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-20 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-ember/40 bg-popover px-3 py-1 text-xs shadow-lg"
        >
          <ArrowDown className="size-3" /> {unseenBelow} new
        </button>
      )}

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={1}
          maxLength={4000}
          className="max-h-40 min-h-10 resize-none"
        />
        <Button type="submit" size="icon-lg" className="bg-heat" disabled={!draft.trim()} aria-label="Send message">
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
