import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { CourseCover } from "@/components/course-cover";
import { ForgeRing, HeatBar } from "@/components/forge-ring";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getRecommended, getStudentDashboard } from "@/lib/data/courses";
import { pct, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "My learning" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [{ courses, unread }, recommended] = await Promise.all([getStudentDashboard(user.id), getRecommended(user.id)]);
  const totals = courses.reduce((a, c) => ({ done: a.done + c.done, total: a.total + c.total }), { done: 0, total: 0 });
  const current = courses.find((c) => c.done < c.total) ?? courses[0];
  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Hi, {firstName}</h1>
          <p className="mt-2 text-muted-foreground">
            {courses.length
              ? `${totals.done} of ${totals.total} lessons finished across ${courses.length} ${courses.length === 1 ? "course" : "courses"}.`
              : "You haven't enrolled in anything yet."}
          </p>
        </div>
        {unread > 0 && (
          <p className="inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 text-sm">
            <MessagesSquare className="size-4 text-ember-hot" />
            {unread} new {unread === 1 ? "reply" : "replies"} from instructors
          </p>
        )}
      </div>

      {current ? (
        <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="resume">
          <div className="grid md:grid-cols-[320px_1fr]">
            <CourseCover id={current.id} title={current.title} category={current.category} url={current.coverUrl} className="aspect-video md:aspect-auto" priority />
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
              <ForgeRing value={pct(current.done, current.total)} size={112} stroke={9}>
                <div className="text-center">
                  <div className="font-mono text-xl tabular-nums">{pct(current.done, current.total)}%</div>
                  <div className="text-[11px] text-muted-foreground">{current.done}/{current.total}</div>
                </div>
              </ForgeRing>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Continue where you left off</p>
                <h2 id="resume" className="mt-1 font-display text-xl font-medium text-balance">{current.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {current.instructorName} · active {timeAgo(current.lastActiveAt)}
                </p>
                <Button asChild className="mt-5 h-11 bg-heat px-6 font-semibold">
                  <Link href={`/learn/${current.id}`}>{current.done === 0 ? "Start the first lesson" : "Resume lesson"}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <h2 className="font-display text-lg">Pick your first course</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Enroll in any course from the catalog and it will show up here with your progress.
          </p>
          <Button asChild className="mt-6 bg-heat font-semibold">
            <Link href="/courses">Browse the catalog</Link>
          </Button>
        </section>
      )}

      {courses.length > 1 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-lg font-medium">Your courses</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {courses.map((c) => {
              const p = pct(c.done, c.total);
              return (
                <li key={c.id}>
                  <Link href={`/learn/${c.id}`} className="flex items-center gap-5 px-5 py-4 transition-colors hover:bg-secondary/50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.title}</div>
                      <div className="mt-2 flex items-center gap-3">
                        <HeatBar value={p} className="max-w-xs" />
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">{p}%</span>
                      </div>
                    </div>
                    <span className="hidden text-sm text-muted-foreground sm:block">{p === 100 ? "Completed" : `${c.total - c.done} left`}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 font-display text-lg font-medium">Popular with other learners</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
