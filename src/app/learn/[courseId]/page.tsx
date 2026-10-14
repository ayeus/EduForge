import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { getLearningView } from "@/lib/data/courses";

/** Sends the learner to the lesson they should do next. */
export default async function LearnIndex({ params }: PageProps<"/learn/[courseId]">) {
  const { courseId } = await params;
  if (!z.uuid().safeParse(courseId).success) notFound();
  const user = await requireUser();
  const view = await getLearningView(courseId, user);
  if (!view) notFound();
  if (!view.enrolled) redirect(`/courses/${courseId}`);
  if (!view.lessons.length) redirect(`/courses/${courseId}`);
  const target =
    view.lessons.find((l) => l.id === view.lastLessonId && !l.completed) ??
    view.lessons.find((l) => !l.completed) ??
    view.lessons.find((l) => l.id === view.lastLessonId) ??
    view.lessons[0];
  redirect(`/learn/${courseId}/${target.id}`);
}
