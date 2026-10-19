"use client";

import { REACTIONS } from "@/lib/live/constants";
import { reactAction } from "@/lib/actions/live";
import type { FloatingReaction } from "./use-live-room";

/** Reactions drifting up the right edge of the player. Decorative, hidden from screen readers. */
export function ReactionLayer({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 overflow-hidden" aria-hidden>
      {reactions.map((r) => (
        <span
          key={r.key}
          className="absolute bottom-6 animate-reaction-rise text-3xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
          style={{ right: `${r.x}%`, ["--drift" as string]: `${(r.key % 2 ? -1 : 1) * (8 + (r.key % 5) * 4)}px` }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

export function ReactionBar({ sessionId, onLocal, disabled }: { sessionId: string; onLocal: (emoji: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Send a reaction">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={disabled}
          onClick={() => {
            onLocal(emoji);
            void reactAction(sessionId, emoji);
          }}
          className="grid size-10 place-items-center rounded-full border border-border bg-card text-lg transition-transform hover:-translate-y-0.5 hover:border-ember/50 active:scale-90 disabled:pointer-events-none disabled:opacity-40"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
