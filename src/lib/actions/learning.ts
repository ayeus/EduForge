"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { lessonAccess, setLessonCompleted } from "@/lib/progress";
import { PASS_PERCENT } from "@/lib/quiz";

const { enrollments, courses, lessons, lessonProgress, quizQuestions, quizAttempts } = schema;

export async function enrollAction(courseId: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(courseId).success) redirect("/courses");
  const [course] = await db
    .select({ id: courses.id, status: courses.status })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course || course.status !== "published") redirect("/courses");
  await db.insert(enrollments).values({ userId: user.id, courseId }).onConflictDoNothing();
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/messages", "layout");
  redirect(`/learn/${courseId}`);
}

export async function unenrollAction(courseId: string) {
  const user = await requireUser();
  await db.delete(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId)));
  revalidatePath("/dashboard");
  revalidatePath(`/courses/${courseId}`);
  redirect("/dashboard");
}

export async function setLessonCompleteAction(lessonId: string, completed: boolean) {
  const user = await requireUser();
  const access = await lessonAccess(user.id, lessonId);
  if (!access) return { error: "Enroll in this course to track progress." };
  const certificateId = await setLessonCompleted(user.id, lessonId, access.courseId, completed);
  revalidatePath(`/learn/${access.courseId}`, "layout");
  revalidatePath("/dashboard");
  return { ok: true, certificateId };
}

/** Resume point. Called periodically by the player; deliberately does not revalidate. */
export async function savePositionAction(lessonId: string, seconds: number) {
  const user = await requireUser();
  const access = await lessonAccess(user.id, lessonId);
  if (!access) return;
  const positionSeconds = Math.max(0, Math.min(Math.floor(seconds), 60 * 60 * 24));
  await db
    .insert(lessonProgress)
    .values({ userId: user.id, lessonId, positionSeconds })
    .onConflictDoUpdate({ target: [lessonProgress.userId, lessonProgress.lessonId], set: { positionSeconds } });
  await db
    .update(enrollments)
    .set({ lastActiveAt: new Date(), lastLessonId: lessonId })
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, access.courseId)));
}

/* ───────────────────────────────── Quizzes ───────────────────────────────── */

const QuestionSchema = z
  .object({
    prompt: z.string().trim().min(3, "Each question needs a prompt.").max(1000),
    options: z
      .array(z.string().trim().min(1, "Answer options can't be empty.").max(300))
      .min(2, "Give each question at least two options.")
      .max(6, "Use at most six options."),
    correctIndex: z.number().int().min(0),
    explanation: z.string().trim().max(1000).default(""),
  })
  .refine((q) => q.correctIndex < q.options.length, "Mark the correct answer.");

const QuizSchema = z.array(QuestionSchema).max(30, "Use at most 30 questions per lesson.");

export type QuizDraft = z.input<typeof QuizSchema>;

export async function saveQuizAction(courseId: string, lessonId: string, questions: QuizDraft) {
  const user = await requireRole("instructor");
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(lessonId).success) return { error: "Lesson not found." };
  const [lesson] = await db
    .select({ id: lessons.id, instructorId: courses.instructorId })
    .from(lessons)
    .innerJoin(courses, eq(courses.id, lessons.courseId))
    .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)))
    .limit(1);
  if (!lesson || (lesson.instructorId !== user.id && user.role !== "admin")) return { error: "Lesson not found." };
  const parsed = QuizSchema.safeParse(questions);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const n = typeof issue.path[0] === "number" ? `Question ${issue.path[0] + 1}: ` : "";
    return { error: `${n}${issue.message}` };
  }
  await db.transaction(async (tx) => {
    await tx.delete(quizQuestions).where(eq(quizQuestions.lessonId, lessonId));
    if (parsed.data.length) {
      await tx.insert(quizQuestions).values(parsed.data.map((q, position) => ({ ...q, lessonId, position })));
    }
  });
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/learn/${courseId}`, "layout");
  return { ok: true as const };
}

export type QuizResult = {
  score: number;
  total: number;
  passed: boolean;
  completedLesson: boolean;
  certificateId: string | null;
  review: { correctIndex: number; chosen: number; explanation: string }[];
};

export async function submitQuizAction(lessonId: string, answers: number[]): Promise<QuizResult | { error: string }> {
  const user = await requireUser();
  const access = await lessonAccess(user.id, lessonId);
  if (!access) return { error: "Enroll in this course to take the quiz." };
  const questions = await db
    .select({ correctIndex: quizQuestions.correctIndex, explanation: quizQuestions.explanation, options: quizQuestions.options })
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, lessonId))
    .orderBy(asc(quizQuestions.position));
  if (!questions.length) return { error: "This lesson has no quiz." };
  if (!Array.isArray(answers) || answers.length !== questions.length || answers.some((a) => !Number.isInteger(a) || a < 0)) {
    return { error: "Answer every question before submitting." };
  }
  const score = questions.reduce((s, q, i) => s + (answers[i] === q.correctIndex ? 1 : 0), 0);
  const total = questions.length;
  const passed = (score / total) * 100 >= PASS_PERCENT;
  await db.insert(quizAttempts).values({ userId: user.id, lessonId, score, total, answers });

  let completedLesson = false;
  let certificateId: string | null = null;
  if (passed) {
    const [progress] = await db
      .select({ completed: lessonProgress.completed })
      .from(lessonProgress)
      .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, lessonId)))
      .limit(1);
    if (!progress?.completed) {
      certificateId = await setLessonCompleted(user.id, lessonId, access.courseId, true);
      completedLesson = true;
    }
  }
  revalidatePath(`/learn/${access.courseId}`, "layout");
  revalidatePath("/dashboard");
  return {
    score,
    total,
    passed,
    completedLesson,
    certificateId,
    review: questions.map((q, i) => ({ correctIndex: q.correctIndex, chosen: answers[i], explanation: q.explanation })),
  };
}
