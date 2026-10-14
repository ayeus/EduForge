import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Thread } from "@/components/thread";
import { db, schema } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { authorizeThread, getThreadMessages } from "@/lib/data/messages";
import { eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: PageProps<"/studio/inbox/[courseId]/[studentId]">) {
  const { courseId, studentId } = await params;
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(studentId).success) notFound();
  const user = await requireRole("instructor");
  const thread = await authorizeThread(user, courseId, studentId);
  if (!thread || !thread.isInstructor) notFound();
  const [[student], messages] = await Promise.all([
    db.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, studentId)).limit(1),
    getThreadMessages(courseId, studentId),
  ]);
  if (!student) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-medium">{student.name}</h2>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </div>
        <Link href={`/studio/courses/${courseId}`} className="text-sm text-muted-foreground hover:text-foreground">
          {thread.course.title}
        </Link>
      </div>
      <Thread
        key={`${courseId}-${studentId}`}
        courseId={courseId}
        studentId={studentId}
        viewerId={user.id}
        initial={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        emptyText={`Start the conversation with ${student.name}.`}
        placeholder={`Reply to ${student.name}`}
      />
    </div>
  );
}
