"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Bot, RotateCcw, Square } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STARTERS = ["Summarize this lesson in 3 points", "Quiz me on this lesson", "Explain the hardest idea here simply"];

export function TutorChat({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/tutor", body: { courseId, lessonId } }),
    [courseId, lessonId],
  );
  const { messages, sendMessage, status, stop, error, regenerate, setMessages } = useChat({ transport });
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-heat text-primary-foreground"><Bot className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Forge, your AI tutor</div>
          <div className="text-xs text-muted-foreground">Knows this lesson&apos;s notes. Can make mistakes, so double-check important facts.</div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} disabled={busy}>
            <RotateCcw /> New chat
          </Button>
        )}
      </div>

      <div className="max-h-[480px] min-h-[200px] space-y-5 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Ask about anything in this lesson.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ember/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user" ? "rounded-br-sm bg-secondary" : "rounded-bl-sm border border-border bg-background/40",
              )}
            >
              {m.parts.map((part, i) =>
                part.type === "text" ? (
                  m.role === "user" ? (
                    <p key={i} className="whitespace-pre-wrap">{part.text}</p>
                  ) : (
                    <Markdown key={i} className="text-sm leading-6">{part.text}</Markdown>
                  )
                ) : null,
              )}
            </div>
          </div>
        ))}
        {status === "submitted" && (
          <div className="flex gap-1 px-2" aria-label="Forge is thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-ember" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="flex-1">{friendlyError(error.message)}</span>
            <Button size="sm" variant="ghost" onClick={() => regenerate()}>Retry</Button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask Forge a question"
          aria-label="Ask Forge a question"
          rows={1}
          maxLength={4000}
          className="max-h-40 min-h-10 resize-none"
        />
        {busy ? (
          <Button type="button" size="icon" variant="outline" onClick={() => stop()} aria-label="Stop generating">
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon" className="bg-heat" disabled={!input.trim()} aria-label="Send">
            <ArrowUp />
          </Button>
        )}
      </form>
    </div>
  );
}

function friendlyError(message: string) {
  try {
    const parsed = JSON.parse(message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {}
  return "Forge couldn't answer just now. Try again.";
}
