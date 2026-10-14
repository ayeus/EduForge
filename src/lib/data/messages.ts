import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/dal";

const { messages, courses, users } = schema;

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
      .select({ c: schema.enrollments.courseId })
      .from(schema.enrollments)
      .where(and(eq(schema.enrollments.courseId, courseId), eq(schema.enrollments.userId, studentId)))
      .limit(1);
    if (!e) return null;
  }
  return { course, isInstructor };
}

export async function getThreadMessages(courseId: string, studentId: string) {
  return db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      senderName: users.name,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(and(eq(messages.courseId, courseId), eq(messages.studentId, studentId)))
    .orderBy(asc(messages.createdAt))
    .limit(500);
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
      lastAt: sql<Date>`max(${messages.createdAt})`.mapWith((v) => new Date(v)),
      lastBody: sql<string>`(array_agg(${messages.body} order by ${messages.createdAt} desc))[1]`,
      unread: sql<number>`count(*) filter (where ${messages.senderId} = ${messages.studentId} and ${messages.readAt} is null)::int`,
    })
    .from(messages)
    .innerJoin(courses, eq(courses.id, messages.courseId))
    .innerJoin(users, eq(users.id, messages.studentId))
    .where(inArray(messages.courseId, ids))
    .groupBy(messages.courseId, courses.title, messages.studentId, users.name)
    .orderBy(desc(sql`max(${messages.createdAt})`));
}
