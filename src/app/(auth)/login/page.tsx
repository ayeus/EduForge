import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Sign in to pick up where you left off.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
