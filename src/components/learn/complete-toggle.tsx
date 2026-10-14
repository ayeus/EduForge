"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setLessonCompleteAction } from "@/lib/actions/learning";
import { cn } from "@/lib/utils";

export function CompleteToggle({ lessonId, completed }: { lessonId: string; completed: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(completed);
  const [pending, start] = useTransition();
  return (
    <Button
      variant={optimistic ? "secondary" : "outline"}
      aria-pressed={optimistic}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res = await setLessonCompleteAction(lessonId, !optimistic);
          if (res?.error) toast.error(res.error);
          else if (!optimistic) toast.success("Lesson marked complete.");
        })
      }
      className={cn("h-10", optimistic && "border-ember/50 text-ember-hot")}
    >
      <Check className={cn(optimistic ? "opacity-100" : "opacity-40")} />
      {optimistic ? "Completed" : "Mark as complete"}
    </Button>
  );
}
