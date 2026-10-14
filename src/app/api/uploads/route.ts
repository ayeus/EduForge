import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { db, schema } from "@/lib/db";
import { UPLOAD_RULES, buildKey, createUploadTarget, driver } from "@/lib/storage";

const Body = z.object({
  courseId: z.uuid(),
  kind: z.enum(["video", "attachment", "cover"]),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  size: z.number().int().positive(),
});

/** Issue a short-lived, single-object upload URL. The browser uploads directly to storage. */
export async function POST(request: Request) {
  if (driver() === "local" && process.env.VERCEL) {
    return Response.json({ error: "File storage isn't configured. Set S3_BUCKET_NAME and AWS credentials." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user || user.role === "student") return Response.json({ error: "Not allowed" }, { status: 403 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid upload request" }, { status: 400 });
  const { courseId, kind, filename, contentType, size } = parsed.data;

  const rule = UPLOAD_RULES[kind];
  if (!rule.types.test(contentType)) {
    return Response.json({ error: `Unsupported file type. Use ${rule.label}.` }, { status: 415 });
  }
  if (size > rule.maxBytes) {
    return Response.json({ error: `File is too large. Use ${rule.label}.` }, { status: 413 });
  }

  const ownership =
    user.role === "admin"
      ? eq(schema.courses.id, courseId)
      : and(eq(schema.courses.id, courseId), eq(schema.courses.instructorId, user.id));
  const [course] = await db.select({ id: schema.courses.id }).from(schema.courses).where(ownership).limit(1);
  if (!course) return Response.json({ error: "Course not found" }, { status: 404 });

  const key = buildKey(courseId, kind, filename);
  const target = await createUploadTarget(key, contentType);
  return Response.json({ key, ...target });
}
