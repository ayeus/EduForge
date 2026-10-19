import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import type { Role } from "@/lib/db/schema";
import { readSession } from "./session";

export type CurrentUser = { id: string; name: string; email: string; role: Role };

/** Resolve the signed-in user once per request. Returns null when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const [user] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      passwordChangedAt: schema.users.passwordChangedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.sub))
    .limit(1);
  if (!user) return null;
  // A password change invalidates sessions issued before it (1s slack for the re-issued cookie).
  if (user.passwordChangedAt && (session.iat ?? 0) * 1000 < user.passwordChangedAt.getTime() - 1000) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect((await readSession()) ? "/api/auth/signout" : "/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role) && user.role !== "admin") redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role) {
  return role === "student" ? "/dashboard" : "/studio";
}
