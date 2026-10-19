"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { markNotificationsRead } from "@/lib/notifications";

export async function markNotificationReadAction(id: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return;
  await markNotificationsRead(user.id, { id });
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await markNotificationsRead(user.id);
}
