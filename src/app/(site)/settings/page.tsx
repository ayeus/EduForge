import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PasswordForm, ProfileForm } from "@/components/settings-forms";
import { requireUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [row] = await db.select({ bio: schema.users.bio }).from(schema.users).where(eq(schema.users.id, user.id)).limit(1);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Account settings</h1>
      <section className="mt-10 grid gap-6 border-t border-border pt-8 md:grid-cols-[200px_1fr]" aria-labelledby="profile">
        <div>
          <h2 id="profile" className="font-medium">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">How you appear to {user.role === "student" ? "instructors" : "students"}.</p>
        </div>
        <ProfileForm name={user.name} bio={row?.bio ?? ""} email={user.email} teaching={user.role !== "student"} />
      </section>
      <section className="mt-10 grid gap-6 border-t border-border pt-8 md:grid-cols-[200px_1fr]" aria-labelledby="security">
        <div>
          <h2 id="security" className="font-medium">Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use a password you don&apos;t use anywhere else.</p>
        </div>
        <PasswordForm />
      </section>
    </div>
  );
}
