# EduForge

A learning platform where instructors publish video courses and students learn with progress tracking, a direct line to their instructor and an AI tutor that has read the lesson.

**Stack:** Next.js 16 (App Router, React 19, Turbopack) · TypeScript · Tailwind CSS 4 · shadcn/ui · Postgres + Drizzle ORM · S3 presigned uploads · Vercel AI SDK 7 + AI Gateway.

The original Flask/MySQL version is kept for reference in [`legacy/flask-lms`](legacy/flask-lms). It is not used by the app.

## Features

**Students:** catalog with search and categories, enroll, a player that resumes where you left off and marks a lesson done when the video ends, manual complete toggle, downloadable resources, Markdown notes, per-course progress rings, the "Ask Forge" AI tutor, and a private chat with the instructor.

**Instructors:** Studio dashboard (students, average completion, unread messages), create and edit courses, cover images, lessons with video and resources uploaded straight to S3 with a progress bar, reorder and delete lessons, draft and publish (publishing needs at least one lesson), student roster with progress, and an inbox for replying to students.

**Platform:** signed httpOnly session cookies (JWT, 14 days), bcrypt passwords, server-side authorization on every page, action and route, Zod validation, security headers, private S3 objects served through short-lived signed URLs, and `/api/health` for uptime checks.

## Local development

Requires Node 20.9+, pnpm and Docker.

```bash
pnpm install
docker run -d --name eduforge-pg -e POSTGRES_USER=eduforge -e POSTGRES_PASSWORD=eduforge \
  -e POSTGRES_DB=eduforge -p 54329:5432 postgres:17-alpine
cp .env.example .env.local        # then set AUTH_SECRET: openssl rand -base64 48
pnpm db:migrate
pnpm db:seed                      # demo data, optional
pnpm dev
```

Demo logins from the seed (password `forge-demo-1`): `instructor@eduforge.dev` and `student@eduforge.dev`. Delete or change these before inviting real users.

When `S3_BUCKET_NAME` is empty (or `STORAGE_DRIVER=local`), uploads are stored in `.uploads/`, so you can develop without AWS.

## Deploying to Vercel

1. **Database.** Create a Postgres database, for example Neon from the Vercel Marketplace, which sets `DATABASE_URL` for you. Use the pooled connection string.
2. **Environment variables** (Project → Settings → Environment Variables):

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `DATABASE_URL` | yes | Postgres connection string |
   | `AUTH_SECRET` | yes | 32+ random characters: `openssl rand -base64 48` |
   | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | yes | IAM user limited to the bucket (policy below) |
   | `AWS_REGION` | yes | e.g. `ap-south-1` |
   | `S3_BUCKET_NAME` | yes | Vercel has no persistent disk, so uploads need S3 |
   | `AI_GATEWAY_API_KEY` | for the tutor | Not needed on Vercel if AI Gateway is enabled (OIDC) |
   | `AI_TUTOR_MODEL` | no | Defaults to `anthropic/claude-haiku-5.5` |
   | `NEXT_PUBLIC_SITE_URL` | no | Your production URL, used for metadata |

3. **Deploy.** `pnpm build` runs pending migrations before `next build`, so the schema is created on the first deploy.
4. **S3 CORS.** Browsers upload directly to S3, so the bucket must allow your domain:

   ```bash
   pnpm tsx scripts/s3-cors.ts https://your-app.vercel.app http://localhost:3000
   ```

   Or paste this into S3 → Bucket → Permissions → CORS:

   ```json
   [{ "AllowedOrigins": ["https://your-app.vercel.app"], "AllowedMethods": ["PUT", "GET", "HEAD"],
      "AllowedHeaders": ["Content-Type"], "ExposeHeaders": ["ETag", "Content-Range", "Accept-Ranges", "Content-Length"],
      "MaxAgeSeconds": 3600 }]
   ```

5. **Seed (optional).** `DATABASE_URL=… pnpm db:seed`

### Minimal IAM policy for the app

The bucket can stay fully private (Block Public Access on). The app never uses ACLs.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::YOUR_BUCKET/courses/*"
  }]
}
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Apply migrations, then production build |
| `pnpm typecheck` / `pnpm lint` | Type check / lint |
| `pnpm db:generate` | Create a migration after editing `src/lib/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Insert demo data (skips if present) |
| `pnpm db:studio` | Browse the database |

## Project layout

```
src/
  app/(site)/        catalog, course pages, student dashboard, Studio, inbox
  app/(auth)/        sign in, register
  app/learn/         the lesson player
  app/api/           uploads, tutor, thread polling, health, dev file server
  components/        UI (shadcn in components/ui)
  lib/actions/       server actions (auth, courses, learning, messages)
  lib/data/          queries with ownership and enrollment checks
  lib/auth/          session, passwords, data-access layer
  lib/storage/       S3 and local drivers
  proxy.ts           route gate (re-verified server-side)
drizzle/             SQL migrations
scripts/             migrate, seed, S3 CORS
```

## Known limits

- No password reset or email verification yet, because there's no email provider configured.
- Instructor chat updates by polling every 5 seconds while the tab is visible, not by websockets, which keeps it serverless-friendly.
- The tutor's rate limit (20 requests per minute per user) is per server instance. For hard limits, add a Vercel Firewall rule or a Redis-backed limiter.
- No login brute-force protection beyond bcrypt cost. Add a Vercel Firewall rate-limit rule on `POST /login`.
