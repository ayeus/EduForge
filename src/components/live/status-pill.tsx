import { cn } from "@/lib/utils";
import type { LiveStatus } from "@/lib/db/schema";

/** On-air indicator: pulsing ember dot when live, quiet outline otherwise. */
export function LiveStatusPill({ status, hasReplay, className }: { status: LiveStatus; hasReplay?: boolean; className?: string }) {
  if (status === "live") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-ember/60 bg-ember/15 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-ember-hot",
          className,
        )}
      >
        <span className="size-2 animate-live-pulse rounded-full bg-ember" aria-hidden />
        LIVE
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {status === "scheduled" ? "Upcoming" : hasReplay ? "Replay" : "Ended"}
    </span>
  );
}
