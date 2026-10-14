"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markThreadReadAction, sendMessageAction } from "@/lib/actions/messages";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ThreadMessage = { id: string; body: string; createdAt: string; senderId: string; senderName: string };

const POLL_MS = 5000;

export function Thread({
  courseId,
  studentId,
  viewerId,
  initial,
  emptyText,
  placeholder,
  className,
}: {
  courseId: string;
  studentId: string;
  viewerId: string;
  initial: ThreadMessage[];
  emptyText: string;
  placeholder: string;
  className?: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/threads/${courseId}/${studentId}`, { cache: "no-store" });
    if (res.ok) setMessages(((await res.json()) as { messages: ThreadMessage[] }).messages);
  }, [courseId, studentId]);

  // Poll while the tab is visible. Simple, serverless-friendly real-time.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const startPolling = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") timer = setInterval(refresh, POLL_MS);
    };
    startPolling();
    document.addEventListener("visibilitychange", startPolling);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", startPolling);
    };
  }, [refresh]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    if (lastId) void markThreadReadAction(courseId, studentId);
  }, [lastId, courseId, studentId]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    start(async () => {
      const optimistic: ThreadMessage = {
        id: `tmp-${Date.now()}`,
        body,
        createdAt: new Date().toISOString(),
        senderId: viewerId,
        senderName: "You",
      };
      setMessages((m) => [...m, optimistic]);
      setDraft("");
      const res = await sendMessageAction(courseId, studentId, body);
      if (res?.error) {
        toast.error(res.error);
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(body);
      } else {
        await refresh();
      }
    });
  };

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card", className)}>
      <div ref={listRef} className="max-h-[480px] min-h-[200px] flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                    mine ? "rounded-br-sm bg-ember/15 ring-1 ring-ember/30" : "rounded-bl-sm bg-secondary",
                  )}
                >
                  {m.body}
                </div>
                <span className="mt-1 px-1 text-[11px] text-muted-foreground">
                  {mine ? "You" : m.senderName} · {timeAgo(m.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
        <Button type="submit" size="icon" className="bg-heat" disabled={pending || !draft.trim()} aria-label="Send message">
          <ArrowUp />
        </Button>
      </form>
    </div>
  );
}
