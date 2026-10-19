import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Thread } from "@/components/thread";
import { requireUser } from "@/lib/auth/dal";
import { authorizeThread, getThreadMessages, getUserCard, serializeMessage } from "@/lib/data/messages";

export const metadata: Metadata = { title: "Conversation" };

export default async function StudentThreadPage({ params }: PageProps<"/messages/[courseId]">) {
  const { courseId } = await params;
  if (!z.uuid().safeParse(courseId).success) notFound();
  const user = await requireUser();
  const thread = await authorizeThread(user, courseId, user.id);
  if (!thread || thread.isInstructor) notFound();
  const [instructor, messages] = await Promise.all([
    getUserCard(thread.course.instructorId),
    getThreadMessages(courseId, user.id),
  ]);
  if (!instructor) notFound();

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/messages" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground md:hidden">
          <ArrowLeft className="size-4" /> All conversations
        </Link>
        <Link href={`/learn/${courseId}`} className="truncate text-sm text-muted-foreground hover:text-foreground md:ml-auto">
          {thread.course.title}
        </Link>
      </div>
      <Thread
        key={courseId}
        courseId={courseId}
        studentId={user.id}
        viewerId={user.id}
        peer={{ id: instructor.id, name: instructor.name, lastSeenAt: instructor.lastSeenAt, subtitle: "Instructor" }}
        initial={messages.map(serializeMessage)}
        emptyText={`Ask ${instructor.name} anything about ${thread.course.title}. They'll be notified right away.`}
        placeholder={`Message ${instructor.name}`}
      />
    </div>
  );
}
