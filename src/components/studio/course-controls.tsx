"use client";

import { useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteCourseAction, deleteLessonAction, moveLessonAction, setCourseStatusAction } from "@/lib/actions/courses";

export function PublishToggle({ courseId, status }: { courseId: string; status: "draft" | "published" }) {
  const [pending, start] = useTransition();
  const publish = status === "draft";
  return (
    <Button
      disabled={pending}
      variant={publish ? "default" : "outline"}
      className={publish ? "bg-heat font-semibold" : undefined}
      onClick={() =>
        start(async () => {
          const res = await setCourseStatusAction(courseId, publish ? "published" : "draft");
          if (res?.error) toast.error(res.error);
          else if (res?.message) toast.success(res.message);
        })
      }
    >
      {publish ? <Eye /> : <EyeOff />}
      {publish ? "Publish" : "Unpublish"}
    </Button>
  );
}

export function DeleteCourse({ courseId, title }: { courseId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive"><Trash2 /> Delete course</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the course, its lessons, uploaded files, enrollments, student progress and messages.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep course</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await deleteCourseAction(courseId);
                if (res?.error) toast.error(res.error);
              });
            }}
          >
            {pending ? "Deleting…" : "Delete course"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LessonRowActions({
  courseId,
  lessonId,
  title,
  first,
  last,
}: {
  courseId: string;
  lessonId: string;
  title: string;
  first: boolean;
  last: boolean;
}) {
  const [pending, start] = useTransition();
  const move = (d: -1 | 1) => start(async () => void (await moveLessonAction(courseId, lessonId, d)));
  return (
    <>
      <Button variant="ghost" size="icon-sm" disabled={first || pending} onClick={() => move(-1)} aria-label={`Move ${title} up`}><ArrowUp /></Button>
      <Button variant="ghost" size="icon-sm" disabled={last || pending} onClick={() => move(1)} aria-label={`Move ${title} down`}><ArrowDown /></Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${title}`} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>The lesson, its video and resources, and students&apos; progress on it are removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep lesson</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                start(async () => {
                  const res = await deleteLessonAction(courseId, lessonId);
                  if (res?.error) toast.error(res.error);
                  else if (res?.message) toast.success(res.message);
                })
              }
            >
              Delete lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
