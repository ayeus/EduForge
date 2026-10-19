import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { z } from "zod";
import { Logo } from "@/components/logo";
import { ForgeRing } from "@/components/forge-ring";
import { Markdown } from "@/components/markdown";
import { CompleteToggle } from "@/components/learn/complete-toggle";
import { LessonTabs } from "@/components/learn/lesson-tabs";
import { LessonPlayer } from "@/components/learn/lesson-player";
import { QuizPanel } from "@/components/learn/quiz-panel";
import { LiveNowBanner } from "@/components/live/live-now-banner";
import { LocalTime } from "@/components/local-time";
import { NotificationBell } from "@/components/notifications/bell";
import { Syllabus, SyllabusSheet } from "@/components/learn/syllabus";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getLearningView } from "@/lib/data/courses";
import { getAnnouncements, getQuizForStudent } from "@/lib/data/engagement";
import { getThreadMessages, getUserCard, serializeMessage } from "@/lib/data/messages";
import { getLiveNow } from "@/lib/live/sessions";
import { pct } from "@/lib/format";
import { fileUrl } from "@/lib/storage";

async function load(courseId: string, lessonId: string) {
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(lessonId).success) notFound();
  const user = await requireUser();
  const view = await getLearningView(courseId, user);
  if (!view) notFound();
  if (!view.enrolled) redirect(`/courses/${courseId}`);
  const index = view.lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) notFound();
  return { user, view, index, lesson: view.lessons[index] };
}

export async function generateMetadata({ params }: PageProps<"/learn/[courseId]/[lessonId]">): Promise<Metadata> {
  const { courseId, lessonId } = await params;
  const { view, lesson } = await load(courseId, lessonId);
  return { title: `${lesson.title} · ${view.course.title}` };
}

export default async function LessonPage({ params }: PageProps<"/learn/[courseId]/[lessonId]">) {
  const { courseId, lessonId } = await params;
  const { user, view, index, lesson } = await load(courseId, lessonId);
  const preview = !view.isEnrolled;
  const done = view.lessons.filter((l) => l.completed).length;
  const prev = view.lessons[index - 1];
  const next = view.lessons[index + 1];

  const [videoUrl, attachmentUrl, thread, instructor, quiz, announcements, liveNow] = await Promise.all([
    fileUrl(lesson.videoKey),
    fileUrl(lesson.attachmentKey, { downloadName: lesson.attachmentName ?? undefined }),
    preview ? Promise.resolve([]) : getThreadMessages(courseId, user.id),
    getUserCard(view.course.instructorId),
    getQuizForStudent(lesson.id, user.id),
    getAnnouncements(courseId, 10),
    getLiveNow(courseId),
  ]);

  const syllabus = view.lessons.map((l) => ({ id: l.id, title: l.title, completed: l.completed, durationSeconds: l.durationSeconds }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl">
        <Button asChild variant="ghost" size="icon" aria-label="Back to dashboard">
          <Link href={preview ? `/studio/courses/${courseId}` : "/dashboard"}><ArrowLeft /></Link>
        </Button>
        <Logo className="hidden sm:inline-flex" href="/dashboard" />
        <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground sm:border-l sm:border-border sm:pl-4">
          <Link href={`/courses/${courseId}`} className="hover:text-foreground">{view.course.title}</Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:block">{done}/{view.lessons.length} done</span>
          <ForgeRing value={pct(done, view.lessons.length)} size={36} stroke={4}>
            <span className="sr-only">{pct(done, view.lessons.length)}%</span>
          </ForgeRing>
          <NotificationBell />
          <SyllabusSheet courseId={courseId} activeId={lesson.id} lessons={syllabus} />
        </div>
      </header>
      <LiveNowBanner courseId={courseId} initial={liveNow} />

      <main id="main" className="mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 px-4 py-6 sm:px-8">
          {preview && (
            <p className="mb-4 rounded-lg border border-ember/40 bg-ember/10 px-4 py-2 text-sm">
              You&apos;re previewing your own course. Progress isn&apos;t tracked in preview.
            </p>
          )}
          <LessonPlayer
            key={lesson.id}
            lessonId={lesson.id}
            src={videoUrl}
            startAt={lesson.completed ? 0 : lesson.positionSeconds}
            nextHref={next ? `/learn/${courseId}/${next.id}` : null}
            trackProgress={!preview}
            title={lesson.title}
          />

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">Lesson {index + 1} of {view.lessons.length}</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-balance">{lesson.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {!preview && <CompleteToggle lessonId={lesson.id} completed={lesson.completed} />}
            </div>
          </div>

          <div className="mt-6">
            <LessonTabs
              courseId={courseId}
              lessonId={lesson.id}
              chat={
                !preview && instructor
                  ? {
                      studentId: user.id,
                      peer: { id: instructor.id, name: instructor.name, lastSeenAt: instructor.lastSeenAt, subtitle: "Instructor" },
                      initial: thread.map(serializeMessage),
                    }
                  : undefined
              }
              quiz={
                quiz.questions.length
                  ? {
                      count: quiz.questions.length,
                      node: <QuizPanel lessonId={lesson.id} questions={quiz.questions} best={quiz.best} canSubmit={!preview} />,
                    }
                  : undefined
              }
              updates={{
                count: announcements.length,
                node: announcements.length ? (
                  <ol className="space-y-4">
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
                ) : (
                  <p className="text-muted-foreground">No announcements yet. Course updates from {view.course.instructorName} appear here.</p>
                ),
              }}
              notes={
                <div className="space-y-6">
                  {attachmentUrl && (
                    <a
                      href={attachmentUrl}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-ember/50"
                    >
                      <Download className="size-4 text-ember-hot" />
                      <span className="min-w-0 flex-1 truncate">{lesson.attachmentName ?? "Lesson resources"}</span>
                      <span className="text-muted-foreground">Download</span>
                    </a>
                  )}
                  {lesson.content ? (
                    <Markdown>{lesson.content}</Markdown>
                  ) : (
                    <p className="text-muted-foreground">This lesson has no written notes.</p>
                  )}
                </div>
              }
            />
          </div>

          <nav className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6" aria-label="Lesson navigation">
            {prev ? (
              <Button asChild variant="ghost">
                <Link href={`/learn/${courseId}/${prev.id}`}><ChevronLeft /> <span className="max-w-[16ch] truncate sm:max-w-[30ch]">{prev.title}</span></Link>
              </Button>
            ) : <span />}
            {next ? (
              <Button asChild variant="outline">
                <Link href={`/learn/${courseId}/${next.id}`}><span className="max-w-[16ch] truncate sm:max-w-[30ch]">{next.title}</span> <ChevronRight /></Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to my learning</Link>
              </Button>
            )}
          </nav>
        </div>

        <aside className="hidden border-l border-border lg:block">
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
            <Syllabus courseId={courseId} activeId={lesson.id} lessons={syllabus} />
          </div>
        </aside>
      </main>
    </div>
  );
}
