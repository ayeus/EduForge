"use client";

import { useState, useTransition } from "react";
import { ListChecks, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveQuizAction } from "@/lib/actions/learning";
import { PASS_PERCENT } from "@/lib/quiz";
import { cn } from "@/lib/utils";

type Question = { prompt: string; options: string[]; correctIndex: number; explanation: string };

const blank = (): Question => ({ prompt: "", options: ["", ""], correctIndex: 0, explanation: "" });

export function QuizEditor({
  courseId,
  lessonId,
  lessonTitle,
  initial,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  initial: Question[];
}) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(initial);
  const [pending, start] = useTransition();

  const update = (qi: number, patch: Partial<Question>) =>
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));

  const save = () =>
    start(async () => {
      const res = await saveQuizAction(courseId, lessonId, questions);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(questions.length ? "Quiz saved." : "Quiz removed.");
      setOpen(false);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setQuestions(initial.length ? initial : [blank()]);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Edit quiz for ${lessonTitle}`}>
          <ListChecks />
          <span className="hidden sm:inline">{initial.length ? `Quiz (${initial.length})` : "Add quiz"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Quiz · {lessonTitle}</DialogTitle>
          <DialogDescription>
            Multiple-choice questions shown under the lesson. Students who score {PASS_PERCENT}% or more complete the lesson automatically.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-4">
          {questions.map((q, qi) => (
            <li key={qi} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-2.5 font-mono text-xs text-muted-foreground tabular-nums">{qi + 1}.</span>
                <Textarea
                  value={q.prompt}
                  onChange={(e) => update(qi, { prompt: e.target.value })}
                  placeholder="Question"
                  aria-label={`Question ${qi + 1}`}
                  rows={2}
                  maxLength={1000}
                  className="min-h-0 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}
                  aria-label={`Remove question ${qi + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>

              <fieldset className="mt-3 space-y-2 pl-6">
                <legend className="sr-only">Answer options for question {qi + 1}</legend>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() => update(qi, { correctIndex: oi })}
                      className="size-4 accent-[var(--ember)]"
                      aria-label={`Mark option ${oi + 1} as the correct answer`}
                    />
                    <Input
                      value={opt}
                      onChange={(e) => update(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                      placeholder={`Option ${oi + 1}`}
                      aria-label={`Option ${oi + 1}`}
                      maxLength={300}
                      className={cn("h-9 flex-1", q.correctIndex === oi && "border-ember/50")}
                    />
                    {q.options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove option ${oi + 1}`}
                        onClick={() =>
                          update(qi, {
                            options: q.options.filter((_, i) => i !== oi),
                            correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex,
                          })
                        }
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {q.options.length < 6 ? (
                    <Button variant="ghost" size="sm" onClick={() => update(qi, { options: [...q.options, ""] })}>
                      <Plus /> Add option
                    </Button>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-muted-foreground">Select the circle next to the correct answer.</span>
                </div>
              </fieldset>

              <Input
                value={q.explanation}
                onChange={(e) => update(qi, { explanation: e.target.value })}
                placeholder="Why this answer is right (shown after submitting, optional)"
                aria-label={`Explanation for question ${qi + 1}`}
                maxLength={1000}
                className="mt-3 ml-6 h-9 w-[calc(100%-1.5rem)]"
              />
            </li>
          ))}
        </ol>

        <Button variant="outline" onClick={() => setQuestions((qs) => [...qs, blank()])} disabled={questions.length >= 30}>
          <Plus /> Add question
        </Button>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={pending} className="bg-heat font-semibold">
            {pending && <Loader2 className="animate-spin" />}
            {questions.length ? "Save quiz" : "Remove quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
