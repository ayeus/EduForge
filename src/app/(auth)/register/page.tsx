import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next, role } = await searchParams;
  return (
    <>
      <h1 className="font-display text-2xl font-semibold">Create your account</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Free for learners and instructors.</p>
      <RegisterForm next={typeof next === "string" ? next : undefined} defaultRole={role === "instructor" ? "instructor" : "student"} />
    </>
  );
}
