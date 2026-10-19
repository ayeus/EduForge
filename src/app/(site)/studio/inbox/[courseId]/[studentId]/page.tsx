import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Thread } from "@/components/thread";
import { requireRole } from "@/lib/auth/dal";
import { authorizeThread, getThreadMessages, getUserCard, serializeMessage } from "@/lib/data/messages";

export const metadata: Metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: PageProps<"/studio/inbox/[courseId]/[studentId]">) {
  const { courseId, studentId } = await params;
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(studentId).success) notFound();
  const user = await requireRole("instructor");
  const thread = await authorizeThread(user, courseId, studentId);
  if (!thread || !thread.isInstructor) notFound();
  const [student, messages] = await Promise.all([getUserCard(studentId), getThreadMessages(courseId, studentId)]);
  if (!student) notFound();

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/studio/inbox" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:hidden">
          <ArrowLeft className="size-4" /> All conversations
        </Link>
        <Link href={`/studio/courses/${courseId}`} className="truncate text-sm text-muted-foreground hover:text-foreground md:ml-auto">
          {thread.course.title}
        </Link>
      </div>
      <Thread
        key={`${courseId}-${studentId}`}
        courseId={courseId}
        studentId={studentId}
        viewerId={user.id}
        peer={{ id: student.id, name: student.name, lastSeenAt: student.lastSeenAt, subtitle: student.email }}
        initial={messages.map(serializeMessage)}
        emptyText={`Start the conversation with ${student.name}.`}
        placeholder={`Reply to ${student.name}`}
      />
    </div>
  );
}
