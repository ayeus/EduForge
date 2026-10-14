/**
 * Seeds demo accounts and courses. Safe to re-run: exits if the demo instructor already exists.
 *   pnpm db:seed
 * Demo logins (change or delete these in production):
 *   instructor@eduforge.dev / forge-demo-1
 *   student@eduforge.dev    / forge-demo-1
 */
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

config({ path: [".env.local", ".env"], quiet: true });

const COURSES = [
  {
    title: "Modern React from first principles",
    summary: "Components, state, server components and streaming — built up one idea at a time.",
    category: "Web Development",
    level: "intermediate" as const,
    description:
      "React rewards people who understand *why* it works. This course rebuilds the mental model from the ground up.\n\n## You'll learn\n- How rendering and reconciliation actually work\n- When to reach for state, refs, and effects (and when not to)\n- Server Components, Suspense and streaming\n- Practical caching strategies",
    lessons: [
      ["Thinking in components", "A component is a function from **data to UI**.\n\n```tsx\nfunction Greeting({ name }: { name: string }) {\n  return <h1>Hello, {name}</h1>;\n}\n```\n\nKeep components small and focused. If you can't name it in two words, split it."],
      ["State and effects", "State is data that changes over time *and* affects what's rendered.\n\n- Use `useState` for local UI state.\n- Derive values during render instead of syncing them with effects.\n- Effects are for synchronising with **external** systems: network, timers, the DOM."],
      ["Server components", "Server Components run only on the server. They can read databases directly and send zero JavaScript for themselves.\n\n> Rule of thumb: start on the server, move to the client only for interactivity."],
      ["Streaming with Suspense", "Wrap slow parts of the tree in `<Suspense>` so the rest of the page renders immediately.\n\n```tsx\n<Suspense fallback={<Skeleton />}>\n  <SlowRecommendations />\n</Suspense>\n```"],
      ["Caching strategies", "Cache at the right layer:\n\n| Layer | Good for |\n| --- | --- |\n| CDN | Public, identical responses |\n| Data cache | Expensive queries shared by users |\n| Request memo | Deduping calls within one render |"],
    ],
  },
  {
    title: "Data analysis with Python and pandas",
    summary: "Load, clean, reshape and visualise real datasets with confidence.",
    category: "Data Science",
    level: "beginner" as const,
    description: "A hands-on introduction to the pandas workflow, from a messy CSV to a clear chart.",
    lessons: [
      ["DataFrames in five minutes", "A `DataFrame` is a table with labelled rows and columns.\n\n```python\nimport pandas as pd\ndf = pd.read_csv('sales.csv')\ndf.head()\n```"],
      ["Cleaning messy data", "Most analysis time goes into cleaning.\n\n- `df.isna().sum()` to find gaps\n- `df.drop_duplicates()`\n- `pd.to_datetime(df['date'])` to fix types"],
      ["Group, aggregate, pivot", "`groupby` splits data, applies a function and combines results.\n\n```python\ndf.groupby('region')['revenue'].sum().sort_values()\n```"],
      ["Telling the story with charts", "Pick the chart for the question: trends → line, comparison → bar, distribution → histogram. Label axes with units."],
    ],
  },
  {
    title: "Interface design fundamentals",
    summary: "Hierarchy, spacing, type and colour for interfaces people enjoy using.",
    category: "Design",
    level: "beginner" as const,
    description: "Practical, opinionated principles you can apply to your next screen today.",
    lessons: [
      ["Visual hierarchy", "Size, weight, colour and position tell people what matters first. Every screen needs one clear primary action."],
      ["Spacing systems", "Use a consistent scale (4, 8, 12, 16, 24, 32…). Related things sit closer together than unrelated things."],
      ["Type that reads well", "Keep body lines under ~75 characters. Use one or two families, with a clear size scale."],
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, "instructor@eduforge.dev"));
  if (existing) {
    console.log("[seed] demo data already present, nothing to do.");
    await client.end();
    return;
  }

  const passwordHash = await bcrypt.hash("forge-demo-1", 12);
  const [instructor] = await db
    .insert(schema.users)
    .values({
      name: "Ada Okafor",
      email: "instructor@eduforge.dev",
      passwordHash,
      role: "instructor",
      bio: "Front-end engineer and teacher. Ten years shipping web apps, five teaching others to.",
    })
    .returning();
  const [student] = await db
    .insert(schema.users)
    .values({ name: "Sam Rivera", email: "student@eduforge.dev", passwordHash, role: "student" })
    .returning();

  for (const [ci, c] of COURSES.entries()) {
    const [course] = await db
      .insert(schema.courses)
      .values({
        title: c.title,
        summary: c.summary,
        description: c.description,
        category: c.category,
        level: c.level,
        instructorId: instructor.id,
        status: "published",
        publishedAt: new Date(Date.now() - ci * 86_400_000),
      })
      .returning();
    const lessons = await db
      .insert(schema.lessons)
      .values(c.lessons.map(([title, content], position) => ({ courseId: course.id, title, content, position })))
      .returning();
    if (ci === 0) {
      await db.insert(schema.enrollments).values({ userId: student.id, courseId: course.id, lastLessonId: lessons[2].id });
      await db.insert(schema.lessonProgress).values(
        lessons.slice(0, 2).map((l) => ({ userId: student.id, lessonId: l.id, completed: true, completedAt: new Date() })),
      );
      await db.insert(schema.messages).values({
        courseId: course.id,
        studentId: student.id,
        senderId: student.id,
        body: "Hi! In the Server Components lesson, can a server component import a client component?",
      });
    }
  }
  console.log("[seed] done. Logins: instructor@eduforge.dev / student@eduforge.dev, password forge-demo-1");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
