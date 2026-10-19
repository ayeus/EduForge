import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { NotificationKind } from "@/lib/db/schema";
import { publish, topics } from "@/lib/realtime/server";

const { notifications } = schema;

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  groupKey: string | null;
  read: boolean;
  createdAt: string;
};

type NotifyInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href: string;
  /** Collapses into the user's existing unread notification with the same key. */
  groupKey?: string;
};

function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function toView(row: typeof notifications.$inferSelect): NotificationView {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    groupKey: row.groupKey,
    read: !!row.readAt,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Read notifications are kept for 90 days; trimmed now and then on write. */
function maybePrune() {
  if (Math.random() < 0.01) {
    db.execute(sql`delete from notifications where read_at is not null and created_at < now() - interval '90 days'`).catch(() => {});
  }
}

/** Store a notification for one person and push it to their open tabs. */
export async function notifyUser(input: NotifyInput) {
  maybePrune();
  const values = {
    userId: input.userId,
    kind: input.kind,
    title: clip(input.title, 160),
    body: clip(input.body ?? "", 280),
    href: input.href,
    groupKey: input.groupKey ?? null,
  };
  const [row] = input.groupKey
    ? await db
        .insert(notifications)
        .values(values)
        .onConflictDoUpdate({
          target: [notifications.userId, notifications.groupKey],
          targetWhere: sql`${notifications.readAt} is null and ${notifications.groupKey} is not null`,
          set: { title: values.title, body: values.body, href: values.href, createdAt: new Date() },
        })
        .returning()
    : await db.insert(notifications).values(values).returning();
  await publish({ topic: topics.user(input.userId), type: "notification", data: toView(row) });
}

/** Notify everyone enrolled in a course: one stored row each, one realtime ping on the course channel. */
export async function notifyCourse(courseId: string, input: Omit<NotifyInput, "userId" | "groupKey">) {
  maybePrune();
  const title = clip(input.title, 160);
  const body = clip(input.body ?? "", 280);
  await db.execute(sql`
    insert into notifications (user_id, kind, title, body, href)
    select user_id, ${input.kind}, ${title}, ${body}, ${input.href}
    from enrollments where course_id = ${courseId}
  `);
  await publish({
    topic: topics.course(courseId),
    type: "notification",
    data: { kind: input.kind, title, body, href: input.href, createdAt: new Date().toISOString() },
  });
}

export async function listNotifications(userId: string, limit = 30) {
  const [rows, [{ unread }]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { unread, items: rows.map(toView) };
}

/** Mark notifications read and tell the person's other tabs. */
export async function markNotificationsRead(userId: string, filter: { id?: string; groupKey?: string } = {}) {
  const conditions = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (filter.id) conditions.push(eq(notifications.id, filter.id));
  if (filter.groupKey) conditions.push(eq(notifications.groupKey, filter.groupKey));
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conditions))
    .returning({ id: notifications.id });
  if (updated.length) {
    await publish({ topic: topics.user(userId), type: "notifications.read", data: { ids: updated.map((u) => u.id) } });
  }
  return updated.length;
}
