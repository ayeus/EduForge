"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { deleteReviewAction, saveReviewAction } from "@/lib/actions/reviews";
import { cn } from "@/lib/utils";

const LABELS = ["", "Not for me", "Needs work", "Good", "Great", "Outstanding"];

export function ReviewForm({ courseId, existing }: { courseId: string; existing: { rating: number; body: string } | null }) {
  const [state, action] = useActionState(saveReviewAction.bind(null, courseId), null);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [removing, startRemove] = useTransition();
  const shown = hover || rating;

  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="rounded-xl border border-border bg-card p-5">
      <fieldset>
        <legend className="text-sm font-medium">{existing ? "Your review" : "Rate this course"}</legend>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  className="peer sr-only"
                  aria-label={`${n} star${n > 1 ? "s" : ""}: ${LABELS[n]}`}
                />
                <Star
                  className={cn(
                    "size-7 transition-transform peer-focus-visible:rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-ring",
                    n <= shown ? "fill-ember-hot text-ember-hot" : "text-muted-foreground/50",
                    hover === n && "scale-110",
                  )}
                />
              </label>
            ))}
          </div>
          <span className="text-sm text-muted-foreground" aria-live="polite">{LABELS[shown]}</span>
        </div>
        {state?.fieldErrors?.rating && <p className="mt-2 text-sm text-destructive">{state.fieldErrors.rating[0]}</p>}
      </fieldset>
      <Textarea
        name="body"
        defaultValue={state?.values?.body ?? existing?.body ?? ""}
        placeholder="What did you learn? What could be better? (optional)"
        aria-label="Review"
        rows={3}
        maxLength={2000}
        className="mt-4"
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SubmitButton className="bg-heat font-semibold" pendingText="Saving…" disabled={!rating}>
          {existing ? "Update review" : "Post review"}
        </SubmitButton>
        {existing && (
          <Button
            type="button"
            variant="ghost"
            disabled={removing}
            onClick={() =>
              startRemove(async () => {
                const res = await deleteReviewAction(courseId);
                if (res?.message) toast.success(res.message);
                setRating(0);
              })
            }
          >
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}
