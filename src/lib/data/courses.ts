import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/dal";
import { fileUrl } from "@/lib/storage";

const { courses, lessons, users, enrollments, lessonProgress, messages } = schema;

// Explicitly qualified: Drizzle omits table names in single-table selects, which would break correlation.
const COURSE_ID = sql.raw(`"courses"."id"`);
const lessonCount = sql<number>`(select count(*)::int from ${lessons} where "lessons"."course_id" = ${COURSE_ID})`;
const studentCount = sql<number>`(select count(*)::int from ${enrollments} where "enrollments"."course_id" = ${COURSE_ID})`;

export async function withCover<T extends { coverKey: string | null }>(rows: T[]) {
  return Promise.all(rows.map(async (r) => ({ ...r, coverUrl: await fileUrl(r.coverKey) })));
}

export async function listCatalog(opts: { q?: string; category?: string } = {}) {
  const filters = [eq(courses.status, "published")];
  if (opts.q) {
    const term = `%${opts.q.replace(/[%_]/g, "")}%`;
    filters.push(or(ilike(courses.title, term), ilike(courses.summary, term), ilike(courses.category, term))!);
  }
  if (opts.category) filters.push(eq(courses.category, opts.category));
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      summary: courses.summary,
      category: courses.category,
      level: courses.level,
      coverKey: courses.coverKey,
      instructorName: users.name,
      lessonCount,
      studentCount,
    })
    .from(courses)
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(and(...filters))
    .orderBy(desc(courses.publishedAt))
    .limit(60);
  return withCover(rows);
}

export async function listCategories() {
  const rows = await db
    .selectDistinct({ category: courses.category })
    .from(courses)
    .where(eq(courses.status, "published"))
    .orderBy(asc(courses.category));
  return rows.map((r) => r.category);
}

export async function getPlatformStats() {
  const [[c], [s], [l]] = await Promise.all([
    db.select({ n: count() }).from(courses).where(eq(courses.status, "published")),
    db.select({ n: count() }).from(users).where(eq(users.role, "student")),
    db.select({ n: count() }).from(lessonProgress).where(eq(lessonProgress.completed, true)),
  ]);
  return { courses: c.n, students: s.n, completions: l.n };
}

/** Course overview for the public detail page. Drafts are visible only to their owner. */
export async function getCourseOverview(courseId: string, viewer: CurrentUser | null) {
  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      summary: courses.summary,
      description: courses.description,
      category: courses.category,
      level: courses.level,
      status: courses.status,
      coverKey: courses.coverKey,
      instructorId: courses.instructorId,
      instructorName: users.name,
      instructorBio: users.bio,
      updatedAt: courses.updatedAt,
      studentCount,
    })
    .from(courses)
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return null;
  const isOwner = viewer && (viewer.id === course.instructorId || viewer.role === "admin");
  if (course.status !== "published" && !isOwner) return null;

  const [syllabus, enrollment] = await Promise.all([
    db
      .select({
        id: lessons.id,
        title: lessons.title,
        durationSeconds: lessons.durationSeconds,
        hasVideo: sql<boolean>`${lessons.videoKey} is not null`,
        hasAttachment: sql<boolean>`${lessons.attachmentKey} is not null`,
      })
      .from(lessons)
      .where(eq(lessons.courseId, courseId))
      .orderBy(asc(lessons.position), asc(lessons.createdAt)),
    viewer
      ? db
          .select()
          .from(enrollments)
          .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, viewer.id)))
          .limit(1)
          .then((r) => r[0] ?? null)
      : null,
  ]);

  return { ...course, coverUrl: await fileUrl(course.coverKey), syllabus, enrollment, isOwner: !!isOwner };
}

/** Everything the player needs. Requires enrollment (or ownership). */
export async function getLearningView(courseId: string, user: CurrentUser) {
  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      instructorId: courses.instructorId,
      instructorName: users.name,
    })
    .from(courses)
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return null;

  const isOwner = user.id === course.instructorId || user.role === "admin";
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, user.id)))
    .limit(1);
  if (!enrollment && !isOwner) return { course, enrolled: false as const };

  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      content: lessons.content,
      videoKey: lessons.videoKey,
      attachmentKey: lessons.attachmentKey,
      attachmentName: lessons.attachmentName,
      durationSeconds: lessons.durationSeconds,
      completed: sql<boolean>`coalesce(${lessonProgress.completed}, false)`,
      positionSeconds: sql<number>`coalesce(${lessonProgress.positionSeconds}, 0)`,
    })
    .from(lessons)
    .leftJoin(lessonProgress, and(eq(lessonProgress.lessonId, lessons.id), eq(lessonProgress.userId, user.id)))
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.position), asc(lessons.createdAt));

  return {
    course,
    enrolled: true as const,
    isOwner,
    isEnrolled: !!enrollment,
    lastLessonId: enrollment?.lastLessonId ?? null,
    lessons: rows,
  };
}

export async function getStudentDashboard(userId: string) {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      summary: courses.summary,
      category: courses.category,
      level: courses.level,
      coverKey: courses.coverKey,
      instructorName: users.name,
      lastLessonId: enrollments.lastLessonId,
      lastActiveAt: enrollments.lastActiveAt,
      total: lessonCount,
      done: sql<number>`(select count(*)::int from ${lessonProgress} lp join ${lessons} l on l.id = lp.lesson_id where l.course_id = ${COURSE_ID} and lp.user_id = ${userId} and lp.completed)`,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.lastActiveAt));

  const [unread] = await db
    .select({ n: count() })
    .from(messages)
    .where(and(eq(messages.studentId, userId), ne(messages.senderId, userId), isNull(messages.readAt)));

  return { courses: await withCover(rows), unread: unread.n };
}

export async function getRecommended(userId: string, limit = 3) {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      summary: courses.summary,
      category: courses.category,
      level: courses.level,
      coverKey: courses.coverKey,
      instructorName: users.name,
      lessonCount,
      studentCount,
    })
    .from(courses)
    .innerJoin(users, eq(users.id, courses.instructorId))
    .where(
      and(
        eq(courses.status, "published"),
        sql`not exists (select 1 from ${enrollments} e where e.course_id = ${COURSE_ID} and e.user_id = ${userId})`,
      ),
    )
    .orderBy(desc(studentCount))
    .limit(limit);
  return withCover(rows);
}

/* ─────────────────────────── Instructor studio ─────────────────────────── */

function ownedBy(user: CurrentUser) {
  return user.role === "admin" ? undefined : eq(courses.instructorId, user.id);
}

export async function getStudio(user: CurrentUser) {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      category: courses.category,
      coverKey: courses.coverKey,
      updatedAt: courses.updatedAt,
      lessonCount,
      studentCount,
      avgCompletion: sql<number>`coalesce((
        select round(avg(pct))::int from (
          select 100.0 * count(lp.lesson_id) filter (where lp.completed)
                 / nullif((select count(*) from lessons l2 where l2.course_id = ${COURSE_ID}), 0) as pct
          from enrollments e
          left join lesson_progress lp
            on lp.user_id = e.user_id
           and lp.lesson_id in (select l3.id from lessons l3 where l3.course_id = ${COURSE_ID})
          where e.course_id = ${COURSE_ID}
          group by e.user_id
        ) t
      ), 0)`,
    })
    .from(courses)
    .where(ownedBy(user))
    .orderBy(desc(courses.updatedAt));

  const ids = rows.map((r) => r.id);
  const [unread] = ids.length
    ? await db
        .select({ n: count() })
        .from(messages)
        .where(and(inArray(messages.courseId, ids), eq(messages.senderId, messages.studentId), isNull(messages.readAt)))
    : [{ n: 0 }];

  return { courses: await withCover(rows), unread: unread.n };
}

export async function getCourseForEdit(courseId: string, user: CurrentUser) {
  const owner = ownedBy(user);
  const [course] = await db
    .select()
    .from(courses)
    .where(owner ? and(eq(courses.id, courseId), owner) : eq(courses.id, courseId))
    .limit(1);
  if (!course) return null;
  const lessonRows = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(lessons.position), asc(lessons.createdAt));
  return { ...course, coverUrl: await fileUrl(course.coverKey), lessons: lessonRows };
}

export async function getRoster(courseId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      enrolledAt: enrollments.createdAt,
      lastActiveAt: enrollments.lastActiveAt,
      done: sql<number>`(select count(*)::int from ${lessonProgress} lp join ${lessons} l on l.id = lp.lesson_id where l.course_id = ${courseId} and lp.user_id = ${users.id} and lp.completed)`,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(eq(enrollments.courseId, courseId))
    .orderBy(desc(enrollments.lastActiveAt));
}
