import { InboxList } from "@/components/studio/inbox-list";
import { requireRole } from "@/lib/auth/dal";
import { getInstructorInbox } from "@/lib/data/messages";

export default async function InboxLayout({ children }: LayoutProps<"/studio/inbox">) {
  const user = await requireRole("instructor");
  const threads = await getInstructorInbox(user);
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Inbox</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-[340px_1fr]">
        <InboxList
          threads={threads.map((t) => ({ ...t, lastAt: t.lastAt.toISOString() }))}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
