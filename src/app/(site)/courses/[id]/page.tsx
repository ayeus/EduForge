import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, FileText, Layers, PlayCircle, Users } from "lucide-react";
import { CourseCover } from "@/components/course-cover";
import { Markdown } from "@/components/markdown";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { enrollAction } from "@/lib/actions/learning";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCourseOverview } from "@/lib/data/courses";
import { LEVEL_LABEL, duration } from "@/lib/format";
import { z } from "zod";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getCurrentUser();
  const course = await getCourseOverview(id, user);
  if (!course) notFound();
  return { user, course };
}

export async function generateMetadata({ params }: PageProps<"/courses/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { course } = await load(id);
  return { title: course.title, description: course.summary || undefined };
}

export default async function CourseOverviewPage({ params }: PageProps<"/courses/[id]">) {
  const { id } = await params;
  const { user, course } = await load(id);
  const totalSeconds = course.syllabus.reduce((s, l) => s + (l.durationSeconds ?? 0), 0);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/courses?category=${encodeURIComponent(course.category)}`} className="hover:text-foreground">
            {course.category}
          </Link>
          <span aria-hidden>/</span>
          <span>{LEVEL_LABEL[course.level]}</span>
          {course.status === "draft" && <Badge variant="outline" className="ml-2 border-ember/50 text-ember-hot">Draft preview</Badge>}
        </div>
        <h1 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] leading-tight font-semibold text-balance">{course.title}</h1>
        {course.summary && <p className="mt-4 max-w-[65ch] text-lg text-muted-foreground">{course.summary}</p>}
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span>By <span className="text-foreground">{course.instructorName}</span></span>
          <span className="inline-flex items-center gap-1.5"><Layers className="size-4" />{course.syllabus.length} lessons</span>
          {totalSeconds > 0 && <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{duration(totalSeconds)}</span>}
          <span className="inline-flex items-center gap-1.5"><Users className="size-4" />{course.studentCount} enrolled</span>
        </div>

        {course.description && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-lg font-medium">About this course</h2>
            <Markdown>{course.description}</Markdown>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-4 font-display text-lg font-medium">Syllabus</h2>
          {course.syllabus.length ? (
            <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {course.syllabus.map((l, i) => (
                <li key={l.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="w-6 font-mono text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  {l.hasAttachment && <FileText className="size-4 text-muted-foreground" aria-label="Has resources" />}
                  {l.hasVideo && <PlayCircle className="size-4 text-muted-foreground" aria-label="Video" />}
                  {l.durationSeconds ? (
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{duration(l.durationSeconds)}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">Lessons are on their way.</p>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <CourseCover id={course.id} title={course.title} category={course.category} url={course.coverUrl} className="aspect-video" priority />
          <div className="space-y-4 p-6">
            {course.isOwner ? (
              <Button asChild className="w-full">
                <Link href={`/studio/courses/${course.id}`}>Edit in studio</Link>
              </Button>
            ) : course.enrollment ? (
              <Button asChild className="h-11 w-full bg-heat font-semibold">
                <Link href={`/learn/${course.id}`}>Continue learning</Link>
              </Button>
            ) : user ? (
              <form action={enrollAction.bind(null, course.id)}>
                <SubmitButton className="h-11 w-full bg-heat font-semibold" pendingText="Enrolling…">
                  Enroll for free
                </SubmitButton>
              </form>
            ) : (
              <Button asChild className="h-11 w-full bg-heat font-semibold">
                <Link href={`/register?next=${encodeURIComponent(`/courses/${course.id}`)}`}>Sign up to enroll</Link>
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Progress tracking, AI tutor and instructor chat included.
            </p>
          </div>
          {course.instructorBio && (
            <div className="border-t border-border p-6 text-sm">
              <div className="font-medium">{course.instructorName}</div>
              <p className="mt-1 text-muted-foreground">{course.instructorBio}</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
