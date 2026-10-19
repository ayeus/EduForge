"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { scheduleLiveAction, updateLiveAction } from "@/lib/actions/live";
import type { FormState } from "@/lib/actions/types";

/** "YYYY-MM-DDTHH:mm" in the browser's timezone, as datetime-local inputs expect. */
function toLocalInput(date: Date) {
  const off = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - off).toISOString().slice(0, 16);
}

function nextHalfHour() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

type Defaults = { title: string; description: string; scheduledFor: string };

function ScheduleFields({
  action,
  defaults,
  submitLabel,
  courses,
  onDone,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: Defaults;
  submitLabel: string;
  courses?: { id: string; title: string }[];
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const [local, setLocal] = useState(() => toLocalInput(defaults ? new Date(defaults.scheduledFor) : nextHalfHour()));
  const fe = state?.fieldErrors;
  const v: Partial<Defaults> & Record<string, string | undefined> = { ...defaults, ...state?.values };
  const iso = local ? new Date(local).toISOString() : "";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      if (state.message) toast.success(state.message);
      onDone?.();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {courses && (
        <Field id="courseId" label="Course" errors={fe?.courseId}>
          <Select name="courseId" defaultValue={v.courseId ?? courses[0]?.id}>
            <SelectTrigger id="courseId" className="w-full data-[size=default]:h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field id="live-title" label="Title" errors={fe?.title}>
        <Input
          id="live-title"
          name="title"
          defaultValue={v.title}
          maxLength={140}
          required
          aria-invalid={!!fe?.title}
          className="h-11"
          placeholder="e.g. Office hours: debugging your first API"
        />
      </Field>
      <Field id="live-when" label="Starts" errors={fe?.scheduledFor} hint={`Your time zone: ${tz}. Students see it in theirs.`}>
        <Input
          id="live-when"
          type="datetime-local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          required
          aria-invalid={!!fe?.scheduledFor}
          className="h-11 [color-scheme:dark]"
        />
        <input type="hidden" name="scheduledFor" value={iso} />
      </Field>
      <Field id="live-description" label="What you'll cover" errors={fe?.description} hint="Optional. Shown on the class page.">
        <Textarea id="live-description" name="description" defaultValue={v.description} rows={4} maxLength={5000} />
      </Field>
      <SubmitButton className="h-11 w-full bg-heat font-semibold" pendingText="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export function ScheduleLiveDialog({
  courseId,
  courses,
  trigger,
}: {
  courseId?: string;
  courses?: { id: string; title: string }[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const action = courseId
    ? scheduleLiveAction.bind(null, courseId)
    : async (state: FormState, formData: FormData) => scheduleLiveAction(String(formData.get("courseId")), state, formData);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-heat font-semibold">
            <Plus /> Schedule live class
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><CalendarClock className="size-5 text-ember-hot" /> Schedule a live class</DialogTitle>
          <DialogDescription>Enrolled students are notified now and again the moment you go live.</DialogDescription>
        </DialogHeader>
        {open && <ScheduleFields action={action} courses={courseId ? undefined : courses} submitLabel="Schedule class" />}
      </DialogContent>
    </Dialog>
  );
}

export function EditLiveDialog({ sessionId, defaults }: { sessionId: string; defaults: Defaults }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit details</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Edit live class</DialogTitle>
          <DialogDescription>Changes show up for students right away.</DialogDescription>
        </DialogHeader>
        {open && (
          <ScheduleFields
            action={updateLiveAction.bind(null, sessionId)}
            defaults={defaults}
            submitLabel="Save changes"
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
