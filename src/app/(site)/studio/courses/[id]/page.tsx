import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, ListChecks, PlayCircle, Star } from "lucide-react";
import { z } from "zod";
import { HeatBar } from "@/components/forge-ring";
import { CourseForm } from "@/components/studio/course-form";
import { DeleteCourse, LessonRowActions, PublishToggle } from "@/components/studio/course-controls";
import { LessonEditor } from "@/components/studio/lesson-editor";
import { AnnouncementComposer, AnnouncementList } from "@/components/studio/announcements";
import { QuizEditor } from "@/components/studio/quiz-editor";
import { ScheduleLiveDialog } from "@/components/live/schedule-form";
import { SessionRows } from "@/components/live/session-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateCourseAction } from "@/lib/actions/courses";
import { requireRole } from "@/lib/auth/dal";
import { getCourseForEdit, getRoster } from "@/lib/data/courses";
import { getAnnouncements, getQuizzesForCourse, getReviewSummary } from "@/lib/data/engagement";
import { listLiveForCourse } from "@/lib/live/sessions";
import { duration, pct, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Edit course" };

const TABS = ["lessons", "live", "announcements", "students", "details"] as const;

export default async function EditCoursePage({ params, searchParams }: PageProps<"/studio/courses/[id]">) {
  const { id } = await params;
  const { tab } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireRole("instructor");
  const course = await getCourseForEdit(id, user);
  if (!course) notFound();
  const [roster, quizzes, live, announcements, rating] = await Promise.all([
    getRoster(id),
    getQuizzesForCourse(id),
    listLiveForCourse(id),
    getAnnouncements(id, 50),
    getReviewSummary(id),
  ]);
  const total = course.lessons.length;
  const defaultTab = TABS.includes(tab as (typeof TABS)[number]) ? (tab as string) : "lessons";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/studio" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Studio
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-balance sm:text-3xl">{course.title}</h1>
            {course.status === "draft" ? (
              <Badge variant="outline">Draft</Badge>
            ) : (
              <Badge variant="outline" className="border-ember/40 bg-ember/10 text-ember-hot">Published</Badge>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            {total} lessons · {roster.length} students · {course.category}
            {rating.total > 0 && (
              <Link href={`/courses/${course.id}#reviews`} className="inline-flex items-center gap-1 hover:text-foreground">
                · <Star className="size-3.5 fill-ember-hot text-ember-hot" /> {rating.average.toFixed(1)} ({rating.total})
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/courses/${course.id}`} target="_blank"><ExternalLink /> Course page</Link>
          </Button>
          {total > 0 && (
            <Button asChild variant="outline">
              <Link href={`/learn/${course.id}/${course.lessons[0].id}`}><PlayCircle /> Preview</Link>
            </Button>
          )}
          <PublishToggle courseId={course.id} status={course.status} />
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="mt-8">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-10">
            <TabsTrigger value="lessons" className="px-4">Lessons</TabsTrigger>
            <TabsTrigger value="live" className="px-4">Live classes</TabsTrigger>
            <TabsTrigger value="announcements" className="px-4">Announcements</TabsTrigger>
            <TabsTrigger value="students" className="px-4">Students ({roster.length})</TabsTrigger>
            <TabsTrigger value="details" className="px-4">Details</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="lessons" className="pt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {total ? "Students see lessons in this order." : "Add your first lesson to be able to publish."}
            </p>
            <LessonEditor courseId={course.id} />
          </div>
          {total > 0 && (
            <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {course.lessons.map((l, i) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className="w-6 font-mono text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1 basis-[220px]">
                    <div className="truncate font-medium">{l.title}</div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {l.videoKey ? (
                        <span className="inline-flex items-center gap-1"><PlayCircle className="size-3" /> Video{l.durationSeconds ? ` · ${duration(l.durationSeconds)}` : ""}</span>
                      ) : (
                        <span>Reading</span>
                      )}
                      {l.attachmentName && <span className="inline-flex items-center gap-1"><FileText className="size-3" /> {l.attachmentName}</span>}
                      {quizzes[l.id]?.length ? (
                        <span className="inline-flex items-center gap-1"><ListChecks className="size-3" /> {quizzes[l.id].length}-question quiz</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center">
                    <QuizEditor courseId={course.id} lessonId={l.id} lessonTitle={l.title} initial={quizzes[l.id] ?? []} />
                    <LessonEditor courseId={course.id} lesson={l} index={i} />
                    <LessonRowActions courseId={course.id} lessonId={l.id} title={l.title} first={i === 0} last={i === total - 1} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="live" className="pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {course.status === "published"
                ? "Enrolled students are notified when you schedule a class and again when you go live."
                : "You can schedule classes now. Students can join once the course is published."}
            </p>
            <ScheduleLiveDialog courseId={course.id} />
          </div>
          <SessionRows sessions={live} host empty="No live classes yet. Schedule one to teach in real time." />
        </TabsContent>

        <TabsContent value="announcements" className="pt-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AnnouncementComposer courseId={course.id} published={course.status === "published"} />
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Sent</h2>
              <AnnouncementList courseId={course.id} items={announcements} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="details" className="max-w-2xl pt-6">
          <CourseForm
            action={updateCourseAction.bind(null, course.id)}
            courseId={course.id}
            defaults={course}
            submitLabel="Save details"
            pendingLabel="Saving…"
          />
          <div className="mt-12 rounded-xl border border-destructive/30 p-5">
            <h2 className="font-medium">Delete this course</h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">Removes everything, including student progress. This can&apos;t be undone.</p>
            <DeleteCourse courseId={course.id} title={course.title} />
          </div>
        </TabsContent>

        <TabsContent value="students" className="pt-6">
          {roster.length ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-[40%]">Progress</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead className="text-right">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((s) => {
                    const p = pct(s.done, total);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <HeatBar value={p} />
                            <span className="w-10 font-mono text-xs tabular-nums">{p}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{timeAgo(s.lastActiveAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/studio/inbox/${course.id}/${s.id}`}>Open chat</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {course.status === "draft" ? "Publish the course so students can enroll." : "No one has enrolled yet."}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
