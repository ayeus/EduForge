import Link from "next/link";
import { ConversationList } from "@/components/conversation-list";
import { requireUser } from "@/lib/auth/dal";
import { getStudentConversations } from "@/lib/data/messages";

export default async function MessagesLayout({ children }: LayoutProps<"/messages">) {
  const user = await requireUser();
  const conversations = await getStudentConversations(user.id);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Messages</h1>
      <p className="mt-2 text-muted-foreground">A private line to the instructor of every course you take.</p>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
        <ConversationList
          rootHref="/messages"
          empty={
            <>
              Enroll in a course to message its instructor.{" "}
              <Link href="/courses" className="text-foreground underline underline-offset-4">Browse the catalog</Link>
            </>
          }
          rows={conversations.map((c) => ({
            href: `/messages/${c.courseId}`,
            name: c.instructorName,
            context: c.courseTitle,
            lastAt: c.lastAt?.toISOString() ?? null,
            lastBody: c.lastBody,
            unread: c.unread,
            lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
          }))}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
