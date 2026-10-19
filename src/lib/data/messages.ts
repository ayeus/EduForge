import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/dal";

const { messages, courses, users, enrollments } = schema;

export const threadKey = (courseId: string, studentId: string) => `thread:${courseId}:${studentId}`;

/** A thread is identified by (courseId, studentId). Returns the thread if the viewer may see it. */
export async function authorizeThread(user: CurrentUser, courseId: string, studentId: string) {
  const [course] = await db
    .select({ id: courses.id, instructorId: courses.instructorId, title: courses.title })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return null;
  const isStudent = user.id === studentId;
  const isInstructor = user.id === course.instructorId || user.role === "admin";
  if (!isStudent && !isInstructor) return null;
  if (isStudent) {
    const [e] = await db
      .select({ c: enrollments.courseId })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, studentId)))
      .limit(1);
    if (!e) return null;
  }
  return { course, isInstructor: isInstructor && !isStudent };
}

export type ThreadMessageRow = Awaited<ReturnType<typeof getThreadMessages>>[number];

export async function getThreadMessages(courseId: string, studentId: string) {
  return db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      readAt: messages.readAt,
      senderId: messages.senderId,
      senderName: users.name,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(and(eq(messages.courseId, courseId), eq(messages.studentId, studentId)))
    .orderBy(asc(messages.createdAt))
    .limit(500);
}

export function serializeMessage(m: ThreadMessageRow) {
  return { ...m, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null };
}

/** The other person in a thread, with their last-seen time for presence. */
export async function getUserCard(userId: string) {
  const [u] = await db
    .select({ id: users.id, name: users.name, email: users.email, lastSeenAt: users.lastSeenAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ? { ...u, lastSeenAt: u.lastSeenAt?.toISOString() ?? null } : null;
}

/** Inbox for an instructor: one row per (course, student) thread, newest first. */
export async function getInstructorInbox(user: CurrentUser) {
  const owned = await db
    .select({ id: courses.id })
    .from(courses)
    .where(user.role === "admin" ? undefined : eq(courses.instructorId, user.id));
  if (!owned.length) return [];
  const ids = owned.map((c) => c.id);
  return db
    .select({
      courseId: messages.courseId,
      courseTitle: courses.title,
      studentId: messages.studentId,
      studentName: users.name,
      lastSeenAt: users.lastSeenAt,
      lastAt: sql<Date>`max(${messages.createdAt})`.mapWith((v) => new Date(v)),
      lastBody: sql<string>`(array_agg(${messages.body} order by ${messages.createdAt} desc))[1]`,
      unread: sql<number>`count(*) filter (where ${messages.senderId} = ${messages.studentId} and ${messages.readAt} is null)::int`,
    })
    .from(messages)
    .innerJoin(courses, eq(courses.id, messages.courseId))
    .innerJoin(users, eq(users.id, messages.studentId))
    .where(inArray(messages.courseId, ids))
    .groupBy(messages.courseId, courses.title, messages.studentId, users.name, users.lastSeenAt)
    .orderBy(desc(sql`max(${messages.createdAt})`));
}

/**
 * A student's conversations: one per enrolled course (even before the first message),
 * with the instructor's presence and the latest message. Active threads first.
 */
export async function getStudentConversations(userId: string) {
  const rows = await db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      instructorId: courses.instructorId,
      instructorName: users.name,
      lastSeenAt: users.lastSeenAt,
      lastAt: sql<Date | null>`(select max(m.created_at) from ${messages} m where m.course_id = ${courses.id} and m.student_id = ${userId})`.mapWith(
        (v) => (v ? new Date(v) : null),
      ),
      lastBody: sql<string | null>`(select m.body from ${messages} m where m.course_id = ${courses.id} and m.student_id = ${userId} order by m.created_at desc limit 1)`,
      unread: sql<number>`(select count(*)::int from ${messages} m where m.course_id = ${courses.id} and m.student_id = ${userId} and m.sender_id <> ${userId} and m.read_at is null)`,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(eq(enrollments.userId, userId));
  return rows.sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
}

export async function unreadMessageCount(user: CurrentUser) {
  if (user.role === "student") {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.studentId, user.id), ne(messages.senderId, user.id), isNull(messages.readAt)));
    return r.n;
  }
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(courses, eq(courses.id, messages.courseId))
    .where(
      and(
        user.role === "admin" ? undefined : eq(courses.instructorId, user.id),
        eq(messages.senderId, messages.studentId),
        isNull(messages.readAt),
      ),
    );
  return r.n;
}
