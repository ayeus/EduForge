"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, ListOrdered, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { duration } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; completed: boolean; durationSeconds: number | null };
type Props = { courseId: string; activeId: string; lessons: Item[]; onNavigate?: () => void };

export function Syllabus({ courseId, activeId, lessons, onNavigate }: Props) {
  return (
    <nav aria-label="Course lessons" className="p-3">
      <p className="px-3 pt-2 pb-3 text-xs text-muted-foreground">Lessons</p>
      <ol className="space-y-0.5">
        {lessons.map((l, i) => {
          const active = l.id === activeId;
          return (
            <li key={l.id}>
              <Link
                href={`/learn/${courseId}/${l.id}`}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-secondary text-foreground shadow-[inset_2px_0_0_var(--ember)]" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <span className="mt-0.5">
                  {l.completed ? (
                    <CheckCircle2 className="size-4 text-ember" aria-label="Completed" />
                  ) : active ? (
                    <PlayCircle className="size-4 text-ember-hot" aria-label="Current" />
                  ) : (
                    <Circle className="size-4" aria-label="Not started" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">
                    <span className="font-mono text-xs tabular-nums opacity-60">{i + 1}.</span> {l.title}
                  </span>
                  {l.durationSeconds ? (
                    <span className="mt-0.5 block font-mono text-[11px] opacity-60">{duration(l.durationSeconds)}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function SyllabusSheet(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Show lessons">
          <ListOrdered />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] overflow-y-auto p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Lessons</SheetTitle>
        </SheetHeader>
        <Syllabus {...props} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
