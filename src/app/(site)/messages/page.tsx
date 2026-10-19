import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesIndex() {
  return (
    <div className="hidden h-full min-h-[320px] place-items-center rounded-xl border border-dashed border-border md:grid">
      <div className="max-w-xs text-center text-sm text-muted-foreground">
        <MessagesSquare className="mx-auto mb-3 size-6" />
        Pick a course to talk to its instructor. Replies show up here the moment they&apos;re sent.
      </div>
    </div>
  );
}
