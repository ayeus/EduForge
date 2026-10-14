"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { FileDrop } from "@/components/studio/file-drop";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveLessonAction } from "@/lib/actions/courses";

type Lesson = {
  id: string;
  title: string;
  content: string;
  videoKey: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
};

export function LessonEditor({ courseId, lesson, index }: { courseId: string; lesson?: Lesson; index?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {lesson ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${lesson.title}`}><Pencil /></Button>
        ) : (
          <Button className="bg-heat font-semibold"><Plus /> Add lesson</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{lesson ? `Edit lesson ${index! + 1}` : "New lesson"}</DialogTitle>
          <DialogDescription>Add a video, notes, or both. Uploads go straight to storage.</DialogDescription>
        </DialogHeader>
        {open && <LessonForm courseId={courseId} lesson={lesson} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function LessonForm({ courseId, lesson, onDone }: { courseId: string; lesson?: Lesson; onDone: () => void }) {
  const [state, action] = useActionState(saveLessonAction.bind(null, courseId, lesson?.id ?? null), null);
  const [video, setVideo] = useState<{ key: string; duration?: number } | null>(null);
  const [attachment, setAttachment] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(0);
  const fe = state?.fieldErrors;

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      onDone();
    }
    if (state?.error) toast.error(state.error);
  }, [state, onDone]);

  const track = (b: boolean) => setBusy((n) => n + (b ? 1 : -1));

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field id="lesson-title" label="Title" errors={fe?.title}>
        <Input id="lesson-title" name="title" defaultValue={state?.values?.title ?? lesson?.title} required maxLength={140} className="h-11" aria-invalid={!!fe?.title} />
      </Field>

      <FileDrop
        courseId={courseId}
        kind="video"
        label="Video"
        current={lesson?.videoKey ? "Current video" : null}
        onUploaded={(r) => setVideo({ key: r.key, duration: r.durationSeconds })}
        onBusyChange={track}
      />
      <input type="hidden" name="videoKey" value={video?.key ?? ""} />
      <input type="hidden" name="durationSeconds" value={video?.duration ?? ""} />
      {lesson?.videoKey && !video && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="removeVideo" className="accent-[var(--ember)]" /> Remove the current video
        </label>
      )}

      <FileDrop
        courseId={courseId}
        kind="attachment"
        label="Resources (optional)"
        current={lesson?.attachmentName}
        onUploaded={(r) => setAttachment({ key: r.key, name: r.name })}
        onBusyChange={track}
      />
      <input type="hidden" name="attachmentKey" value={attachment?.key ?? ""} />
      <input type="hidden" name="attachmentName" value={attachment?.name ?? ""} />
      {lesson?.attachmentKey && !attachment && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="removeAttachment" className="accent-[var(--ember)]" /> Remove the current resource
        </label>
      )}

      <Field id="lesson-content" label="Notes" errors={fe?.content} hint="Markdown supported. The AI tutor reads these notes to answer questions.">
        <Textarea id="lesson-content" name="content" defaultValue={state?.values?.content ?? lesson?.content} rows={10} maxLength={50000} className="min-h-48 font-mono text-[13px]" />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <SubmitButton className="bg-heat font-semibold" disabled={busy > 0} pendingText="Saving…">
          {busy > 0 ? "Waiting for upload…" : lesson ? "Save lesson" : "Add lesson"}
        </SubmitButton>
      </div>
    </form>
  );
}
