"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pin, PinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/components/local-time";
import { deleteLiveChatAction, pinNoteAction, sendLiveChatAction } from "@/lib/actions/live";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./use-live-room";

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function LiveChat({
  sessionId,
  viewerId,
  isHost,
  chat,
  addChat,
  removeChat,
  pinned,
  setPinned,
  closed,
  className,
}: {
  sessionId: string;
  viewerId: string;
  isHost: boolean;
  chat: ChatMessage[];
  addChat: (m: ChatMessage) => void;
  removeChat: (id: string) => void;
  pinned: string | null;
  setPinned: (note: string | null) => void;
  closed: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [stuckToBottom, setStuckToBottom] = useState(true);
  const hydrated = useHydrated();
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = chat.at(-1)?.id;

  useEffect(() => {
    const el = listRef.current;
    if (el && stuckToBottom) el.scrollTop = el.scrollHeight;
  }, [lastId, stuckToBottom]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await sendLiveChatAction(sessionId, body);
    setSending(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setDraft("");
    setStuckToBottom(true);
    addChat(res.message);
  };

  const pin = async (note: string | null) => {
    setPinned(note);
    const res = await pinNoteAction(sessionId, note);
    if (res && "error" in res) toast.error(res.error);
  };

  return (
    <section className={cn("flex min-h-0 flex-col rounded-xl border border-border bg-card", className)} aria-label="Live chat">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-medium">{closed ? "Chat replay" : "Live chat"}</h2>
        <span className="text-xs text-muted-foreground">{chat.length} messages</span>
      </header>

      {pinned && (
        <div className="flex items-start gap-2 border-b border-border bg-ember/[0.06] px-4 py-2.5 text-sm">
          <Pin className="mt-0.5 size-3.5 shrink-0 text-ember-hot" aria-label="Pinned" />
          <p className="min-w-0 flex-1 break-words">{pinned}</p>
          {isHost && (
            <button type="button" onClick={() => void pin(null)} className="text-muted-foreground hover:text-foreground" aria-label="Unpin">
              <PinOff className="size-3.5" />
            </button>
          )}
        </div>
      )}

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setStuckToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
        }}
        className="relative min-h-[260px] flex-1 overflow-y-auto overscroll-contain px-2 py-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {chat.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-balance text-muted-foreground">
            {closed ? "Nobody chatted during this class." : "Say hello. Questions you post here are seen by the instructor and the whole class."}
          </p>
        ) : (
          <ol className="space-y-0.5">
            {chat.map((m) => (
              <li key={m.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/40">
                <p className="min-w-0 flex-1 text-sm leading-relaxed break-words">
                  <span
                    className={cn(
                      "mr-1.5 font-medium",
                      m.host ? "text-ember-hot" : m.userId === viewerId ? "text-foreground" : "text-chart-3",
                    )}
                  >
                    {m.name}
                    {m.host && (
                      <span className="ml-1.5 rounded border border-ember/50 px-1 py-px align-middle font-mono text-[9px] tracking-wide">
                        HOST
                      </span>
                    )}
                  </span>
                  <span className="text-foreground/90">{m.body}</span>
                </p>
                <span className="mt-0.5 shrink-0 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {hydrated ? timeFmt.format(new Date(m.createdAt)) : null}
                </span>
                {isHost && !closed && (
                  <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => void pin(m.body.slice(0, 280))}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Pin message"
                    >
                      <Pin className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeChat(m.id);
                        void deleteLiveChatAction(sessionId, m.id);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                      aria-label="Delete message"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {!stuckToBottom && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setStuckToBottom(true)}
            className="absolute -top-12 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-ember/40 bg-popover px-3 py-1 text-xs shadow-lg"
          >
            <ArrowDown className="size-3" /> Latest
          </button>
        </div>
      )}

      {closed ? (
        <p className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">Chat closed when the class ended.</p>
      ) : (
        <form
          className="flex items-center gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isHost ? "Message the class" : "Ask a question or say hi"}
            aria-label="Chat message"
            maxLength={500}
            className="h-10"
          />
          <Button type="submit" size="icon-lg" className="bg-heat" disabled={!draft.trim() || sending} aria-label="Send">
            <ArrowUp />
          </Button>
        </form>
      )}
    </section>
  );
}
