"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Award, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { submitQuizAction, type QuizResult } from "@/lib/actions/learning";
import { PASS_PERCENT } from "@/lib/quiz";
import { cn } from "@/lib/utils";

type Question = { id: string; prompt: string; options: string[] };

export function QuizPanel({
  lessonId,
  questions,
  best,
  canSubmit,
}: {
  lessonId: string;
  questions: Question[];
  best: { score: number; total: number } | null;
  canSubmit: boolean;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [pending, start] = useTransition();
  const answered = answers.filter((a) => a !== null).length;

  const submit = () =>
    start(async () => {
      const res = await submitQuizAction(lessonId, answers.map((a) => a ?? -1));
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      if (res.completedLesson) toast.success("Quiz passed. Lesson marked complete.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

  const retry = () => {
    setResult(null);
    setAnswers(questions.map(() => null));
  };

  const pct = result ? Math.round((result.score / result.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {result ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-5 rounded-2xl border p-5",
            result.passed ? "border-ember/50 bg-ember/[0.07]" : "border-border bg-card",
          )}
          role="status"
        >
          <div className="font-mono text-4xl font-medium tabular-nums">
            <span className={result.passed ? "text-heat" : undefined}>{pct}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{result.passed ? "Passed" : `Not quite. You need ${PASS_PERCENT}% to pass.`}</p>
            <p className="text-sm text-muted-foreground">
              {result.score} of {result.total} correct. Review the answers below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.certificateId && (
              <Button asChild className="bg-heat font-semibold">
                <Link href={`/certificates/${result.certificateId}`}><Award /> View certificate</Link>
              </Button>
            )}
            <Button variant="outline" onClick={retry}><RotateCcw /> Try again</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {questions.length} {questions.length === 1 ? "question" : "questions"}. Score {PASS_PERCENT}% or more to complete this lesson.
          {best && (
            <>
              {" "}Your best so far: <span className="font-mono text-foreground tabular-nums">{best.score}/{best.total}</span>.
            </>
          )}
        </p>
      )}

      <ol className="space-y-5">
        {questions.map((q, qi) => {
          const review = result?.review[qi];
          return (
            <li key={q.id} className="rounded-xl border border-border bg-card p-5">
              <fieldset>
                <legend className="flex gap-3 text-sm font-medium">
                  <span className="font-mono text-muted-foreground tabular-nums">{qi + 1}.</span>
                  <span className="whitespace-pre-wrap">{q.prompt}</span>
                </legend>
                <RadioGroup
                  className="mt-4 gap-2"
                  value={answers[qi] === null ? "" : String(answers[qi])}
                  onValueChange={(v) => setAnswers((a) => a.map((x, i) => (i === qi ? Number(v) : x)))}
                  disabled={!!result || !canSubmit}
                >
                  {q.options.map((opt, oi) => {
                    const id = `${q.id}-${oi}`;
                    const isCorrect = review && oi === review.correctIndex;
                    const isWrongPick = review && oi === review.chosen && oi !== review.correctIndex;
                    return (
                      <div
                        key={oi}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                          isCorrect
                            ? "border-emerald-400/60 bg-emerald-400/10"
                            : isWrongPick
                              ? "border-destructive/60 bg-destructive/10"
                              : answers[qi] === oi
                                ? "border-ember/50 bg-ember/[0.06]"
                                : "border-border hover:border-input",
                        )}
                      >
                        <RadioGroupItem value={String(oi)} id={id} />
                        <Label htmlFor={id} className="flex-1 cursor-pointer text-sm font-normal">{opt}</Label>
                        {isCorrect && <CheckCircle2 className="size-4 text-emerald-400" aria-label="Correct answer" />}
                        {isWrongPick && <XCircle className="size-4 text-destructive" aria-label="Your answer" />}
                      </div>
                    );
                  })}
                </RadioGroup>
                {review?.explanation && (
                  <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">{review.explanation}</p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {!result && canSubmit && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {answered}/{questions.length} answered
          </span>
          <Button onClick={submit} disabled={pending || answered < questions.length} className="h-11 bg-heat px-6 font-semibold">
            {pending && <Loader2 className="animate-spin" />} Submit answers
          </Button>
        </div>
      )}
      {!canSubmit && <p className="text-sm text-muted-foreground">Quizzes are scored for enrolled students. You&apos;re previewing.</p>}
    </div>
  );
}
