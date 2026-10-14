import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CourseForm } from "@/components/studio/course-form";
import { createCourseAction } from "@/lib/actions/courses";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireRole("instructor");
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/studio" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Studio
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">New course</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Start with the basics. You&apos;ll add lessons and a cover on the next screen.</p>
      <CourseForm action={createCourseAction} submitLabel="Create draft" pendingLabel="Creating…" />
    </div>
  );
}
