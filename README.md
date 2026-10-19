# EduForge

A learning platform where instructors publish video courses and teach live, and students learn with progress tracking, quizzes, certificates, real-time chat with their instructor and an AI tutor that has read the lesson.

**Stack:** Next.js 16 (App Router, React 19, Turbopack) · TypeScript · Tailwind CSS 4 · shadcn/ui · Postgres + Drizzle ORM · S3 presigned uploads · Mux live streaming · Server-Sent Events on Postgres LISTEN/NOTIFY · Vercel AI SDK 7 + AI Gateway.

The original Flask/MySQL version is kept for reference in [`legacy/flask-lms`](legacy/flask-lms). It is not used by the app.

## Features

**Students:** catalog with search, categories and star ratings; enroll; a player that resumes where you left off and marks a lesson done when the video ends; Markdown notes and downloadable resources; lesson quizzes with explanations; progress rings; a shareable, printable certificate when every lesson is done; course reviews; the "Ask Forge" AI tutor; and a Messages page for talking to instructors.

**Live classes:** instructors schedule a class and go live from the control room, either **straight from the browser** (camera, microphone and screen sharing, no extra software) or from OBS, Zoom or a phone app through Mux for large audiences. Students wait in a countdown room, get notified the moment the class goes live, watch with low latency, chat, send reactions, and watch the recording afterwards. Instructors can pin and delete chat messages and end the class for everyone.

**Real time:** messages arrive instantly with typing indicators, online status and read receipts. A notification bell (with optional desktop alerts) covers replies, live classes, announcements, new lessons, reviews and certificates. Unread badges update everywhere without reloading.

**Instructors:** Studio dashboard (students, average completion, unread messages, upcoming live classes), create and edit courses, cover images, lessons with video and resources uploaded straight to S3 with a progress bar, a quiz builder per lesson, reorder and delete lessons, draft and publish, announcements to every enrolled student, student roster with progress, and an inbox.

**Platform:** signed httpOnly session cookies (JWT, 14 days) that are revoked on password change, bcrypt passwords, account settings, server-side authorization on every page, action and route, Zod validation, rate limits on chat, security headers, private S3 objects served through short-lived signed URLs, and `/api/health` for uptime checks.

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

When `S3_BUCKET_NAME` is empty (or `STORAGE_DRIVER=local`), uploads are stored in `.uploads/`, so you can develop without AWS. Without Mux credentials, live classes still work as a waiting room with chat; the control room explains how to connect Mux.

To try real-time features with two accounts at once, sign in as the instructor at `http://localhost:3000` and as the student at `http://127.0.0.1:3000` (cookies are per host).

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
   | `DATABASE_URL_UNPOOLED` | recommended | Direct (non-pooled) connection used for `LISTEN`. Neon sets it automatically. Without it, real time falls back to polling the database once a second |
   | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` | for live classes | Set by the Mux integration, or create an access token with Mux Video read/write |
   | `MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY` | recommended | Signed playback so only enrolled students can watch. Without them, streams use public playback IDs |
   | `MUX_WEBHOOK_SECRET` | no | Point a Mux webhook at `/api/webhooks/mux` for instant status changes. Without it, the app polls Mux |
   | `MUX_TEST_STREAMS` | no | `true` creates free, watermarked 5-minute test streams |
   | `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | recommended | A TURN relay for browser broadcasts, so students behind strict firewalls can connect. Comma-separate several URLs |
   | `LIVE_MAX_BROWSER_VIEWERS` | no | Cap for browser broadcasts (default 30); larger classes should stream through Mux |
   | `AI_GATEWAY_API_KEY` | for the tutor | Not needed on Vercel if AI Gateway is enabled (OIDC) |
   | `AI_TUTOR_MODEL` | no | Defaults to `anthropic/claude-haiku-5.5` |
   | `NEXT_PUBLIC_SITE_URL` | no | Your production URL, used for metadata and certificate links |

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

5. **Live classes.** Browser broadcasts work out of the box. Add a TURN relay (`TURN_URL`, …) so every student can connect. For large classes, add the Mux integration (Vercel → Integrations → Mux), connect it to the project and redeploy; the control room's "OBS or streaming app" option then shows the stream key.
6. **Seed (optional).** `DATABASE_URL=… pnpm db:seed`

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
  app/(site)/        catalog, course pages, dashboard, live classes, messages, certificates, settings, Studio
  app/(auth)/        sign in, register
  app/learn/         the lesson player
  app/api/           realtime stream, uploads, tutor, live status, calendar invites, Mux webhook, health
  components/        UI (shadcn in components/ui), live room and control room, chat, notifications
  lib/actions/       server actions (auth, account, courses, learning, messages, live, reviews, announcements)
  lib/data/          queries with ownership and enrollment checks
  lib/live/          Mux client and live class state machine
  lib/realtime/      event log + LISTEN/NOTIFY fan-out behind the SSE route
  lib/auth/          session, passwords, data-access layer
  lib/storage/       S3 and local drivers
  proxy.ts           route gate (re-verified server-side)
drizzle/             SQL migrations
scripts/             migrate, seed, S3 CORS
```

## How live classes work

**From the browser:** the host's browser sends its camera, microphone or screen to each student over WebRTC (peer to peer). Signalling (offers, answers, ICE candidates) travels over the realtime channel below, so no media server is needed. The host's browser also records the class in ten-minute segments and uploads them to storage; students get them as the replay. A class whose host disappears for three minutes ends itself. Because the host uploads one stream per student, this suits classes up to about 30.

**Through Mux:** the host streams RTMP from OBS, Zoom or a phone to Mux, and students watch Mux's low-latency HLS. Mux records automatically. The class goes live when Mux sees video (polled, or instantly with the webhook).

## How real time works

Every event (a message, a read receipt, a live class going live, a chat line) is written to the `realtime_events` table and announced with Postgres `NOTIFY`. Each server instance holds one `LISTEN` connection while it has viewers and forwards events over Server-Sent Events (`/api/realtime`). Streams close every few minutes and the browser reconnects with `Last-Event-ID`, so missed events are replayed from the table. Typing indicators, reactions and viewer counts are sent with `NOTIFY` only and never stored. No extra service is needed.

## Known limits

- No password reset or email verification yet, because there's no email provider configured.
- Browser broadcasts are peer to peer: without a TURN relay a few students on strict networks may not connect, and the host's upload bandwidth limits class size. Use Mux for big audiences.
- A browser recording segment in progress is lost if the host closes the tab mid-segment; finished segments are kept.
- The tutor's rate limit (20 requests per minute per user) and reaction limits are per server instance. For hard limits, add a Vercel Firewall rule or a Redis-backed limiter.
- No login brute-force protection beyond bcrypt cost. Add a Vercel Firewall rate-limit rule on `POST /login`.
