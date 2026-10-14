"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { FileDrop } from "@/components/studio/file-drop";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/actions/types";

const CATEGORIES = ["Web Development", "Data Science", "Design", "AI & Machine Learning", "Cloud & DevOps", "Mobile", "Business", "Languages", "Mathematics"];

export type CourseFormValues = {
  title: string;
  summary: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
};

export function CourseForm({
  action,
  defaults,
  courseId,
  submitLabel,
  pendingLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults?: CourseFormValues;
  courseId?: string;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [coverKey, setCoverKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const fe = state?.fieldErrors;
  const v = { ...defaults, ...state?.values } as Partial<CourseFormValues>;

  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Field id="title" label="Title" errors={fe?.title}>
        <Input id="title" name="title" defaultValue={v.title} required maxLength={140} aria-invalid={!!fe?.title} className="h-11" placeholder="e.g. Modern React from first principles" />
      </Field>
      <Field id="summary" label="One-line summary" errors={fe?.summary} hint="Shown on course cards. Up to 280 characters.">
        <Input id="summary" name="summary" defaultValue={v.summary} maxLength={280} className="h-11" />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="category" label="Category" errors={fe?.category}>
          <Input id="category" name="category" list="categories" defaultValue={v.category ?? ""} required maxLength={60} aria-invalid={!!fe?.category} className="h-11" />
          <datalist id="categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field id="level" label="Level" errors={fe?.level}>
          <Select name="level" defaultValue={v.level ?? "beginner"}>
            <SelectTrigger id="level" className="w-full data-[size=default]:h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field id="description" label="Description" errors={fe?.description} hint="Markdown is supported: headings, lists, links and code.">
        <Textarea id="description" name="description" defaultValue={v.description} rows={8} maxLength={20000} className="min-h-40" />
      </Field>
      {courseId && (
        <>
          <FileDrop courseId={courseId} kind="cover" label="Cover image" onUploaded={(r) => setCoverKey(r.key)} onBusyChange={setUploading} />
          <input type="hidden" name="coverKey" value={coverKey} />
        </>
      )}
      <SubmitButton className="h-11 bg-heat px-6 font-semibold" pendingText={pendingLabel} disabled={uploading}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
