import Link from "next/link";
import { CalendarPlus, PlayCircle, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Countdown, LocalTime } from "@/components/local-time";
import type { LiveListing } from "@/lib/live/sessions";
import { cn } from "@/lib/utils";
import { LiveStatusPill } from "./status-pill";

function startsWithinADay(date: Date) {
  return date.getTime() - Date.now() < 86_400_000;
}

/** Where a row links to: hosts go to the control room, students to the class page. */
const hrefFor = (s: LiveListing, host: boolean) => (host ? `/studio/live/${s.id}` : `/live/${s.id}`);

export function OnAirCard({ session, host }: { session: LiveListing; host: boolean }) {
  return (
    <Link
      href={hrefFor(session, host)}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-ember/50 bg-card p-6 shadow-[0_0_60px_-25px_var(--ember)] transition-colors hover:border-ember sm:flex-row sm:items-center"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_200px_at_0%_0%,rgb(255_122_47/0.12),transparent_70%)]" aria-hidden />
      <div className="relative min-w-0 flex-1">
        <LiveStatusPill status="live" />
        <h3 className="mt-3 font-display text-xl font-medium text-balance">{session.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.courseTitle} · {session.instructorName}
        </p>
      </div>
      <span className="relative inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-heat px-5 text-sm font-semibold text-primary-foreground sm:self-center">
        <Radio className="size-4" /> {host ? "Open control room" : "Join now"}
      </span>
    </Link>
  );
}

export function SessionRows({ sessions, host, empty }: { sessions: LiveListing[]; host: boolean; empty: React.ReactNode }) {
  if (!sessions.length) {
    return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {sessions.map((s) => {
        const at = (s.status === "ended" ? (s.startedAt ?? s.scheduledFor) : s.scheduledFor).toISOString();
        const soon = s.status === "scheduled" && startsWithinADay(s.scheduledFor);
        return (
          <li key={s.id} className="flex flex-wrap items-center gap-4 px-4 py-4 sm:flex-nowrap sm:px-5">
            <div
              className={cn(
                "grid w-14 shrink-0 place-items-center rounded-lg border py-2 text-center",
                s.status === "live" ? "border-ember/60 bg-ember/10" : "border-border bg-background",
              )}
              aria-hidden
            >
              <DayBlock iso={at} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={hrefFor(s, host)} className="truncate font-medium hover:underline hover:underline-offset-4">
                  {s.title}
                </Link>
                <LiveStatusPill status={s.status} hasReplay={s.hasReplay} />
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {s.courseTitle}
                {!host && <> · {s.instructorName}</>}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <LocalTime iso={at} format="full" />
                {soon && (
                  <>
                    {" · starts in "}
                    <Countdown iso={s.scheduledFor.toISOString()} fallback="now" className="font-mono tabular-nums" />
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {s.status === "scheduled" && !host && (
                <Button asChild variant="ghost" size="icon-lg" aria-label="Add to calendar">
                  <a href={`/api/live/${s.id}/calendar`}><CalendarPlus /></a>
                </Button>
              )}
              <Button asChild variant={s.status === "live" ? "default" : "outline"} className={s.status === "live" ? "bg-heat font-semibold" : undefined}>
                <Link href={hrefFor(s, host)}>
                  {s.status === "ended" ? (
                    <>
                      <PlayCircle /> {s.hasReplay ? "Watch replay" : "View"}
                    </>
                  ) : host ? (
                    "Control room"
                  ) : s.status === "live" ? (
                    "Join"
                  ) : (
                    "Open"
                  )}
                </Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DayBlock({ iso }: { iso: string }) {
  return (
    <>
      <LocalTime iso={iso} format="dayNum" className="block font-mono text-lg leading-none tabular-nums" />
      <LocalTime iso={iso} format="month" className="mt-1 block text-[11px] text-muted-foreground" />
    </>
  );
}
