import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Clock, FileText, Layers, PlayCircle, Star, Users } from "lucide-react";
import { CourseCover } from "@/components/course-cover";
import { ReviewForm } from "@/components/course/review-form";
import { Stars } from "@/components/course/stars";
import { SessionRows } from "@/components/live/session-list";
import { LocalTime } from "@/components/local-time";
import { Markdown } from "@/components/markdown";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { enrollAction } from "@/lib/actions/learning";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCourseOverview } from "@/lib/data/courses";
import { getAnnouncements, getCertificatesForUser, getMyReview, getReviewSummary, getReviews } from "@/lib/data/engagement";
import { listLiveForCourse } from "@/lib/live/sessions";
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
  const member = !!course.enrollment || course.isOwner;
  const [summary, reviews, myReview, announcements, live, certificates] = await Promise.all([
    getReviewSummary(id),
    getReviews(id),
    user && course.enrollment ? getMyReview(id, user.id) : null,
    member ? getAnnouncements(id, 5) : [],
    member ? listLiveForCourse(id) : [],
    user && course.enrollment ? getCertificatesForUser(user.id) : {},
  ]);
  const certificateId = (certificates as Record<string, string>)[id];
  const upcomingLive = live.filter((l) => l.status !== "ended" || l.hasReplay).slice(0, 5);

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
          {summary.total > 0 && (
            <a href="#reviews" className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Star className="size-4 fill-ember-hot text-ember-hot" />
              <span className="text-foreground tabular-nums">{summary.average.toFixed(1)}</span> ({summary.total} {summary.total === 1 ? "review" : "reviews"})
            </a>
          )}
        </div>

        {course.description && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-lg font-medium">About this course</h2>
            <Markdown>{course.description}</Markdown>
          </section>
        )}

        {upcomingLive.length > 0 && (
          <section className="mt-10" aria-labelledby="live-classes">
            <h2 id="live-classes" className="mb-4 font-display text-lg font-medium">Live classes</h2>
            <SessionRows sessions={upcomingLive} host={course.isOwner} empty={null} />
          </section>
        )}

        {announcements.length > 0 && (
          <section id="announcements" className="mt-10 scroll-mt-24" aria-labelledby="announcements-title">
            <h2 id="announcements-title" className="mb-4 font-display text-lg font-medium">Announcements</h2>
            <ol className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium">{a.title}</h3>
                    <LocalTime iso={a.createdAt} format="short" className="text-xs text-muted-foreground" />
                  </div>
                  {a.body && (
                    <div className="mt-3 text-sm">
                      <Markdown>{a.body}</Markdown>
                    </div>
                  )}
                </li>
              ))}
            </ol>
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

        <section id="reviews" className="mt-12 scroll-mt-24" aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="mb-4 font-display text-lg font-medium">Reviews</h2>
          {summary.total > 0 ? (
            <div className="mb-6 grid gap-6 rounded-xl border border-border bg-card p-5 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="text-center sm:pr-6">
                <div className="font-mono text-5xl font-medium tabular-nums">{summary.average.toFixed(1)}</div>
                <Stars value={summary.average} className="mt-2" />
                <div className="mt-1 text-xs text-muted-foreground">{summary.total} {summary.total === 1 ? "review" : "reviews"}</div>
              </div>
              <ul className="space-y-1.5" aria-label="Rating breakdown">
                {summary.distribution.map((d) => (
                  <li key={d.stars} className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="w-10 tabular-nums">{d.stars} star</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full bg-heat" style={{ width: `${summary.total ? (d.n / summary.total) * 100 : 0}%` }} />
                    </span>
                    <span className="w-6 text-right tabular-nums">{d.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mb-6 text-muted-foreground">No reviews yet.{course.enrollment ? " Be the first to share how it's going." : ""}</p>
          )}
          {course.enrollment && !course.isOwner && (
            <div className="mb-6">
              <ReviewForm courseId={course.id} existing={myReview} />
            </div>
          )}
          {reviews.length > 0 && (
            <ul className="divide-y divide-border">
              {reviews.map((r) => (
                <li key={r.userId} className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">{r.name}</span>
                    <Stars value={r.rating} size={14} />
                    <LocalTime iso={r.updatedAt} format="date" className="text-xs text-muted-foreground" />
                  </div>
                  {r.body && <p className="mt-2 max-w-[70ch] text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">{r.body}</p>}
                </li>
              ))}
            </ul>
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
              <>
                <Button asChild className="h-11 w-full bg-heat font-semibold">
                  <Link href={`/learn/${course.id}`}>{certificateId ? "Review the course" : "Continue learning"}</Link>
                </Button>
                {certificateId && (
                  <Button asChild variant="outline" className="h-11 w-full">
                    <Link href={`/certificates/${certificateId}`}><Award /> View certificate</Link>
                  </Button>
                )}
              </>
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
