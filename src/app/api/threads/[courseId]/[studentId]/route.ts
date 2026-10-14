import { getCurrentUser } from "@/lib/auth/dal";
import { authorizeThread, getThreadMessages } from "@/lib/data/messages";
import { z } from "zod";

/** Polled by the chat UI for new messages. */
export async function GET(_: Request, ctx: RouteContext<"/api/threads/[courseId]/[studentId]">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { courseId, studentId } = await ctx.params;
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(studentId).success) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const thread = await authorizeThread(user, courseId, studentId);
  if (!thread) return Response.json({ error: "Not found" }, { status: 404 });
  const messages = await getThreadMessages(courseId, studentId);
  return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}
