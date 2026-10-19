import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { getLiveAccess } from "@/lib/live/sessions";

function ics(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
}

/** Calendar invite (.ics) for a scheduled live class. */
export async function GET(request: Request, ctx: RouteContext<"/api/live/[id]/calendar">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  const access = await getLiveAccess(user, id);
  if (!access) return new Response("Not found", { status: 404 });
  const { session, course } = access;
  const url = new URL(`/live/${id}`, request.url).toString();
  const start = session.scheduledFor;
  const end = new Date(start.getTime() + 60 * 60_000);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EduForge//Live classes//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${id}@eduforge`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(start)}`,
    `DTEND:${ics(end)}`,
    `SUMMARY:${escape(`${session.title} (${course.title})`)}`,
    `DESCRIPTION:${escape(`${session.description ? `${session.description}\n\n` : ""}Join: ${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(session.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="eduforge-live-${id.slice(0, 8)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
