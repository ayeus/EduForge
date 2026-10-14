"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor } from "@/lib/auth/dal";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { echo, type FormState } from "./types";

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Enter your name (2+ characters).").max(80),
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(254),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128)
    .regex(/[A-Za-z]/, "Include at least one letter.")
    .regex(/\d/, "Include at least one number."),
  role: z.enum(["student", "instructor"]),
});

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function registerAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = RegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  const { name, email, password, role } = parsed.data;

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.email})`, email))
    .limit(1);
  if (existing) return { fieldErrors: { email: ["An account with this email already exists. Sign in instead."] }, values: echo(formData) };

  const [user] = await db
    .insert(schema.users)
    .values({ name, email, role, passwordHash: await hashPassword(password) })
    .returning({ id: schema.users.id, role: schema.users.role });

  await createSession({ sub: user.id, role: user.role });
  redirect(safeNext(formData.get("next")) ?? homeFor(user.role));
}

const LoginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
});

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  const { email, password } = parsed.data;

  const [user] = await db
    .select({ id: schema.users.id, role: schema.users.role, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(sql`lower(${schema.users.email})`, email))
    .limit(1);

  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { error: "That email and password don't match an account.", values: echo(formData) };

  await createSession({ sub: user.id, role: user.role });
  redirect(safeNext(formData.get("next")) ?? homeFor(user.role));
}

export async function logoutAction() {
  await deleteSession();
  redirect("/");
}
