import { getCurrentUser } from "@/lib/auth/dal";
import { listNotifications } from "@/lib/notifications";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listNotifications(user.id), { headers: { "Cache-Control": "no-store" } });
}
