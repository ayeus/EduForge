import { getCurrentUser } from "@/lib/auth/dal";
import { getCounters } from "@/lib/data/counters";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getCounters(user), { headers: { "Cache-Control": "no-store" } });
}
