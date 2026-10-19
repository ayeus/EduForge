"use client";

import { useState } from "react";
import { Bot, ListChecks, Megaphone, MessagesSquare, NotebookText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TutorChat } from "@/components/learn/tutor-chat";
import { Thread, type ThreadMessage, type ThreadPeer } from "@/components/thread";
import { useRealtime } from "@/components/realtime/provider";

export function LessonTabs({
  courseId,
  lessonId,
  notes,
  quiz,
  updates,
  chat,
}: {
  courseId: string;
  lessonId: string;
  notes: React.ReactNode;
  quiz?: { node: React.ReactNode; count: number };
  updates?: { node: React.ReactNode; count: number };
  chat?: { studentId: string; peer: ThreadPeer; initial: ThreadMessage[] };
}) {
  const [tab, setTab] = useState("notes");
  const [chatUnread, setChatUnread] = useState(false);

  // Flag new instructor replies that arrive while another tab is open.
  useRealtime((m) => {
    if (m.type !== "message" || !chat || tab === "instructor") return;
    const e = m.data as { courseId: string; studentId: string; message: { senderId: string } };
    if (e.courseId === courseId && e.studentId === chat.studentId && e.message.senderId !== chat.studentId) setChatUnread(true);
  });

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v);
        if (v === "instructor") setChatUnread(false);
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="h-10">
          <TabsTrigger value="notes" className="px-3"><NotebookText /> Notes</TabsTrigger>
          {quiz && (
            <TabsTrigger value="quiz" className="px-3">
              <ListChecks /> Quiz <span className="font-mono text-[11px] text-muted-foreground">{quiz.count}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="tutor" className="px-3"><Bot /> Ask Forge</TabsTrigger>
          {chat && (
            <TabsTrigger value="instructor" className="px-3">
              <MessagesSquare /> Instructor
              {chatUnread && <span className="size-2 rounded-full bg-ember" aria-label="New reply" />}
            </TabsTrigger>
          )}
          {updates && (
            <TabsTrigger value="updates" className="px-3">
              <Megaphone /> Updates
              {updates.count > 0 && <span className="font-mono text-[11px] text-muted-foreground">{updates.count}</span>}
            </TabsTrigger>
          )}
        </TabsList>
      </div>
      <TabsContent value="notes" className="pt-6">{notes}</TabsContent>
      {quiz && <TabsContent value="quiz" className="pt-6">{quiz.node}</TabsContent>}
      <TabsContent value="tutor" className="pt-6 data-[state=inactive]:hidden" forceMount>
        <TutorChat courseId={courseId} lessonId={lessonId} />
      </TabsContent>
      {chat && (
        <TabsContent value="instructor" className="pt-6 data-[state=inactive]:hidden" forceMount>
          <Thread
            courseId={courseId}
            studentId={chat.studentId}
            viewerId={chat.studentId}
            peer={chat.peer}
            initial={chat.initial}
            active={tab === "instructor"}
            emptyText={`Ask ${chat.peer.name} anything about this course. They'll be notified right away.`}
            placeholder={`Message ${chat.peer.name}`}
          />
        </TabsContent>
      )}
      {updates && <TabsContent value="updates" className="pt-6">{updates.node}</TabsContent>}
    </Tabs>
  );
}
