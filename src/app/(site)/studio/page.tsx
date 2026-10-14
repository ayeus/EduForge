import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { CourseCover } from "@/components/course-cover";
import { ForgeRing } from "@/components/forge-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { getStudio } from "@/lib/data/courses";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage() {
  const user = await requireRole("instructor");
  const { courses, unread } = await getStudio(user);
  const students = courses.reduce((s, c) => s + c.studentCount, 0);
  const published = courses.filter((c) => c.status === "published").length;
  const withStudents = courses.filter((c) => c.studentCount > 0);
  const avg = withStudents.length ? Math.round(withStudents.reduce((s, c) => s + c.avgCompletion, 0) / withStudents.length) : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Studio</h1>
          <p className="mt-2 text-muted-foreground">Build, publish and follow how your students are doing.</p>
        </div>
        <Button asChild className="h-10 bg-heat font-semibold">
          <Link href="/studio/courses/new"><Plus /> New course</Link>
        </Button>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        <Stat label="Published courses" value={`${published}`} sub={`${courses.length - published} in drafts`} />
        <Stat label="Enrolled students" value={students.toLocaleString()} />
        <div className="flex items-center gap-4 bg-card p-5">
          <ForgeRing value={avg} size={56} stroke={5} label="Average completion" />
          <div>
            <dt className="text-xs text-muted-foreground">Average completion</dt>
            <dd className="mt-1 text-sm text-muted-foreground">across active courses</dd>
          </div>
        </div>
        <Link href="/studio/inbox" className="group bg-card p-5 transition-colors hover:bg-secondary/60">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Inbox className="size-3.5" /> Unread messages</dt>
          <dd className={`mt-2 font-mono text-3xl tabular-nums ${unread ? "text-ember-hot" : ""}`}>{unread}</dd>
        </Link>
      </dl>

      <section className="mt-12">
        <h2 className="mb-4 font-display text-lg font-medium">Your courses</h2>
        {courses.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={`/studio/courses/${c.id}`} className="flex items-center gap-5 p-4 transition-colors hover:bg-secondary/50">
                  <CourseCover id={c.id} title={c.title} category={c.category} url={c.coverUrl} className="hidden aspect-video w-36 shrink-0 rounded-lg sm:block" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.title}</span>
                      {c.status === "draft" ? (
                        <Badge variant="outline">Draft</Badge>
                      ) : (
                        <Badge className="border-ember/40 bg-ember/10 text-ember-hot" variant="outline">Live</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {c.lessonCount} lessons · {c.studentCount} students · edited {timeAgo(c.updatedAt)}
                    </div>
                  </div>
                  {c.studentCount > 0 && <ForgeRing value={c.avgCompletion} size={44} stroke={4} label="Average completion" />}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="font-display text-lg">Your first course starts here</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Create a draft, add lessons with videos and notes, then publish it to the catalog.
            </p>
            <Button asChild className="mt-6 bg-heat font-semibold">
              <Link href="/studio/courses/new"><Plus /> Create a course</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card p-5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-mono text-3xl tabular-nums">{value}</dd>
      {sub && <dd className="mt-1 text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}
