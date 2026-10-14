import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");

// Reuse one client across hot reloads in dev and across invocations in a warm serverless instance.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client =
  globalForDb.pg ??
  postgres(url, {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    // Transaction-mode poolers (Neon/Supabase pooled URLs) don't support prepared statements
    prepare: !/pooler|pgbouncer=true/.test(url),
  });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
