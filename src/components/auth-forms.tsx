"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BookOpenCheck, Presentation } from "lucide-react";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { loginAction, registerAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, null);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Field id="email" label="Email" errors={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} required aria-invalid={!!fe?.email} className="h-11" />
      </Field>
      <Field id="password" label="Password" errors={fe?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!fe?.password} className="h-11" />
      </Field>
      <SubmitButton className="h-11 w-full bg-heat font-semibold" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        New to EduForge?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next, defaultRole }: { next?: string; defaultRole: "student" | "instructor" }) {
  const [state, action] = useActionState(registerAction, null);
  const [role, setRole] = useState(defaultRole);
  const fe = state?.fieldErrors;
  const roles = [
    { value: "student", title: "Learn", body: "Take courses and track progress", icon: BookOpenCheck },
    { value: "instructor", title: "Teach", body: "Publish courses and mentor", icon: Presentation },
  ] as const;
  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">I want to</legend>
        <div className="grid grid-cols-2 gap-3">
          {roles.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                role === r.value ? "border-ember/70 bg-ember/10" : "border-border hover:border-input",
              )}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="sr-only"
              />
              <r.icon className={cn("size-5", role === r.value ? "text-ember-hot" : "text-muted-foreground")} />
              <span className="mt-1 text-sm font-medium">{r.title}</span>
              <span className="text-xs text-muted-foreground">{r.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="name" label="Full name" errors={fe?.name}>
        <Input id="name" name="name" autoComplete="name" defaultValue={state?.values?.name} required aria-invalid={!!fe?.name} className="h-11" />
      </Field>
      <Field id="email" label="Email" errors={fe?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} required aria-invalid={!!fe?.email} className="h-11" />
      </Field>
      <Field id="password" label="Password" errors={fe?.password} hint="8+ characters with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!fe?.password} className="h-11" />
      </Field>
      <SubmitButton className="h-11 w-full bg-heat font-semibold" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
