"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { LocalTime } from "@/components/local-time";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteAnnouncementAction, postAnnouncementAction } from "@/lib/actions/announcements";
import { plainText } from "@/lib/format";

type Announcement = { id: string; title: string; body: string; createdAt: string };

export function AnnouncementComposer({ courseId, published }: { courseId: string; published: boolean }) {
  const [state, action] = useActionState(postAnnouncementAction.bind(null, courseId), null);
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state?.fieldErrors;

  useEffect(() => {
    if (state?.ok) {
      if (state.message) toast.success(state.message);
      formRef.current?.reset();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-xl border border-border bg-card p-5" noValidate>
      <div className="flex items-center gap-2 font-display text-sm font-medium">
        <Megaphone className="size-4 text-ember-hot" /> New announcement
      </div>
      <Field id="ann-title" label="Title" errors={fe?.title}>
        <Input id="ann-title" name="title" defaultValue={state?.ok ? "" : state?.values?.title} maxLength={140} className="h-11" placeholder="e.g. Week 3 materials are up" />
      </Field>
      <Field id="ann-body" label="Message" errors={fe?.body} hint="Markdown is supported.">
        <Textarea id="ann-body" name="body" defaultValue={state?.ok ? "" : state?.values?.body} rows={5} maxLength={10000} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="bg-heat font-semibold" pendingText="Sending…">Send to students</SubmitButton>
        <span className="text-xs text-muted-foreground">
          {published ? "Every enrolled student gets a notification." : "Saved on the course. Students see it once the course is published."}
        </span>
      </div>
    </form>
  );
}

export function AnnouncementList({ courseId, items }: { courseId: string; items: Announcement[] }) {
  const [pending, start] = useTransition();
  if (!items.length) return <p className="text-sm text-muted-foreground">No announcements yet.</p>;
  return (
    <ol className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium">{a.title}</h3>
              <LocalTime iso={a.createdAt} format="full" className="text-xs text-muted-foreground" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={`Delete announcement ${a.title}`}
              onClick={() =>
                start(async () => {
                  const res = await deleteAnnouncementAction(courseId, a.id);
                  if (res?.error) toast.error(res.error);
                })
              }
            >
              <Trash2 />
            </Button>
          </div>
          {a.body && <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{plainText(a.body)}</p>}
        </li>
      ))}
    </ol>
  );
}
