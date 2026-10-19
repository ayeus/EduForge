"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/account";

export function ProfileForm({ name, bio, email, teaching }: { name: string; bio: string; email: string; teaching: boolean }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const fe = state?.fieldErrors;
  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);
  return (
    <form action={action} className="space-y-5" noValidate>
      <Field id="email" label="Email" hint="Your sign-in email can't be changed here.">
        <Input id="email" value={email} readOnly disabled className="h-11" />
      </Field>
      <Field id="name" label="Name" errors={fe?.name}>
        <Input id="name" name="name" defaultValue={state?.values?.name ?? name} maxLength={80} required aria-invalid={!!fe?.name} className="h-11" autoComplete="name" />
      </Field>
      <Field
        id="bio"
        label="Bio"
        errors={fe?.bio}
        hint={teaching ? "Shown to students on your course pages." : "A line or two about you. Optional."}
      >
        <Textarea id="bio" name="bio" defaultValue={state?.values?.bio ?? bio} rows={4} maxLength={600} />
      </Field>
      <SubmitButton className="h-11 bg-heat px-6 font-semibold" pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
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
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      <Field id="current" label="Current password" errors={fe?.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required aria-invalid={!!fe?.current} className="h-11" />
      </Field>
      <Field id="password" label="New password" errors={fe?.password} hint="At least 8 characters, with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!fe?.password} className="h-11" />
      </Field>
      <Field id="confirm" label="Confirm new password" errors={fe?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={!!fe?.confirm} className="h-11" />
      </Field>
      <SubmitButton variant="outline" className="h-11 px-6" pendingText="Changing…">Change password</SubmitButton>
      <p className="text-xs text-muted-foreground">Changing your password signs you out everywhere else.</p>
    </form>
  );
}
