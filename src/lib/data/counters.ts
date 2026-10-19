import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { CurrentUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { unreadMessageCount } from "./messages";

export type Counters = { messages: number; notifications: number };

/** Badge counts for the header: unread chat messages and unread notifications. */
export async function getCounters(user: CurrentUser): Promise<Counters> {
  const [messages, [n]] = await Promise.all([
    unreadMessageCount(user),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))),
  ]);
  return { messages, notifications: n.n };
}
