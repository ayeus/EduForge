"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { echo, type FormState } from "./types";

const ProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name (2+ characters).").max(80),
  bio: z.string().trim().max(600, "Keep your bio under 600 characters.").default(""),
});

export async function updateProfileAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: echo(formData) };
  await db
    .update(schema.users)
    .set({ name: parsed.data.name, bio: parsed.data.bio || null })
    .where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

const PasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "The passwords don't match." });

export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = PasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const [row] = await db
    .select({ hash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);
  if (!row || !(await verifyPassword(parsed.data.current, row.hash))) {
    return { fieldErrors: { current: ["That isn't your current password."] } };
  }
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.password), passwordChangedAt: new Date() })
    .where(eq(schema.users.id, user.id));
  // Older sessions are now rejected; keep this device signed in with a fresh one.
  await createSession({ sub: user.id, role: user.role });
  return { ok: true, message: "Password changed. Other devices have been signed out." };
}
