import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxIndex() {
  return (
    <div className="hidden h-full min-h-[300px] place-items-center rounded-xl border border-dashed border-border md:grid">
      <div className="text-center text-sm text-muted-foreground">
        <MessagesSquare className="mx-auto mb-3 size-6" />
        Pick a conversation to read and reply.
      </div>
    </div>
  );
}
