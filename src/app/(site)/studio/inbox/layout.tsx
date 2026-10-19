import { ConversationList } from "@/components/conversation-list";
import { requireRole } from "@/lib/auth/dal";
import { getInstructorInbox } from "@/lib/data/messages";

export default async function InboxLayout({ children }: LayoutProps<"/studio/inbox">) {
  const user = await requireRole("instructor");
  const threads = await getInstructorInbox(user);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Inbox</h1>
      <p className="mt-2 text-muted-foreground">Messages from your students arrive here instantly.</p>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
        <ConversationList
          rootHref="/studio/inbox"
          empty="No messages yet. Students can message you from any lesson or their Messages page."
          rows={threads.map((t) => ({
            href: `/studio/inbox/${t.courseId}/${t.studentId}`,
            name: t.studentName,
            context: t.courseTitle,
            lastAt: t.lastAt.toISOString(),
            lastBody: t.lastBody,
            unread: t.unread,
            lastSeenAt: t.lastSeenAt?.toISOString() ?? null,
          }))}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
