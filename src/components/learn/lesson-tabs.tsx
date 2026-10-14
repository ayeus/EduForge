"use client";

import { Bot, MessagesSquare, NotebookText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Thread, type ThreadMessage } from "@/components/thread";
import { TutorChat } from "@/components/learn/tutor-chat";

export function LessonTabs({
  courseId,
  lessonId,
  studentId,
  instructorName,
  initialThread,
  chatEnabled,
  notes,
}: {
  courseId: string;
  lessonId: string;
  studentId: string;
  instructorName: string;
  initialThread: ThreadMessage[];
  chatEnabled: boolean;
  notes: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="notes">
      <TabsList className="h-10">
        <TabsTrigger value="notes" className="px-3"><NotebookText /> Notes</TabsTrigger>
        <TabsTrigger value="tutor" className="px-3"><Bot /> Ask Forge</TabsTrigger>
        {chatEnabled && <TabsTrigger value="instructor" className="px-3"><MessagesSquare /> Instructor</TabsTrigger>}
      </TabsList>
      <TabsContent value="notes" className="pt-6">{notes}</TabsContent>
      <TabsContent value="tutor" className="pt-6 data-[state=inactive]:hidden" forceMount>
        <TutorChat courseId={courseId} lessonId={lessonId} />
      </TabsContent>
      {chatEnabled && (
        <TabsContent value="instructor" className="pt-6 data-[state=inactive]:hidden" forceMount>
          <Thread
            courseId={courseId}
            studentId={studentId}
            viewerId={studentId}
            initial={initialThread}
            emptyText={`Ask ${instructorName} anything about this course. They'll see it in their inbox.`}
            placeholder={`Message ${instructorName}`}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
