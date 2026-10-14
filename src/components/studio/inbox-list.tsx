"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type ThreadRow = {
  courseId: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  lastAt: string;
  lastBody: string;
  unread: number;
};

export function InboxList({ threads }: { threads: ThreadRow[] }) {
  const pathname = usePathname();
  if (!threads.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No messages yet. Students can message you from any lesson.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border self-start overflow-hidden rounded-xl border border-border bg-card">
      {threads.map((t) => {
        const href = `/studio/inbox/${t.courseId}/${t.studentId}`;
        const active = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block px-4 py-3 transition-colors hover:bg-secondary/50",
                active && "bg-secondary shadow-[inset_2px_0_0_var(--ember)]",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("min-w-0 flex-1 truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.studentName}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(t.lastAt)}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">{t.courseTitle}</div>
              <div className="mt-1 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{t.lastBody}</p>
                {t.unread > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-heat px-1.5 font-mono text-[11px] text-primary-foreground">{t.unread}</span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
