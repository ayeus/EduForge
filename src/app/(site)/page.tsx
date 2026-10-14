import Link from "next/link";
import { Bot, CheckCircle2, Circle, MessagesSquare, PlayCircle, Upload } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { ForgeRing } from "@/components/forge-ring";
import { Button } from "@/components/ui/button";
import { getCurrentUser, homeFor } from "@/lib/auth/dal";
import { getPlatformStats, listCatalog } from "@/lib/data/courses";

export default async function HomePage() {
  const [user, stats, featured] = await Promise.all([getCurrentUser(), getPlatformStats(), listCatalog()]);
  const primaryHref = user ? homeFor(user.role) : "/register";

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/70">
        <div className="absolute inset-0 bg-blueprint [mask-image:radial-gradient(80%_70%_at_70%_30%,black,transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24 lg:pb-28">
          <div className="max-w-xl">
            <h1 className="animate-forge-rise font-display text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.02] font-semibold text-balance">
              Courses that turn into skills.
            </h1>
            <p className="animate-forge-rise mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground [animation-delay:120ms]">
              Watch the lesson, check it off, ask the AI tutor when you&apos;re stuck and message your instructor when you need a human.
              Every finished lesson heats your progress ring a little more.
            </p>
            <div className="animate-forge-rise mt-9 flex flex-wrap gap-3 [animation-delay:220ms]">
              <Button asChild size="lg" className="h-11 bg-heat px-6 font-semibold">
                <Link href={primaryHref}>{user ? "Continue learning" : "Create a free account"}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-6">
                <Link href="/courses">Browse the catalog</Link>
              </Button>
            </div>
            <dl className="animate-forge-rise mt-12 grid max-w-md grid-cols-3 gap-6 [animation-delay:320ms]">
              {[
                ["Courses", stats.courses],
                ["Learners", stats.students],
                ["Lessons finished", stats.completions],
              ].map(([label, n]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-mono text-2xl tabular-nums">{Number(n).toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          </div>

          <LearningConsole />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-medium">New in the catalog</h2>
            <Link href="/courses" className="text-sm text-muted-foreground hover:text-foreground">
              See all courses
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.slice(0, 6).map((c, i) => (
              <CourseCard key={c.id} course={c} priority={i < 3} />
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border/70 bg-[var(--steel)]/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-medium">For learners</h2>
            <ul className="mt-6 space-y-5">
              <Feature icon={PlayCircle} title="Pick up where you left off">
                The player remembers your position in every video and marks a lesson done when you finish it.
              </Feature>
              <Feature icon={Bot} title="An AI tutor that read the lesson">
                Forge answers questions using the notes of the lesson you&apos;re on, then checks your understanding.
              </Feature>
              <Feature icon={MessagesSquare} title="A direct line to your instructor">
                Each course has a private conversation between you and the person who made it.
              </Feature>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-xl font-medium">For instructors</h2>
            <ul className="mt-6 space-y-5">
              <Feature icon={Upload} title="Upload straight to the cloud">
                Videos up to 2 GB go directly to storage with a live progress bar, no timeouts.
              </Feature>
              <Feature icon={CheckCircle2} title="Draft, reorder, publish">
                Build lessons privately, reorder them, then publish when the course is ready.
              </Feature>
              <Feature icon={MessagesSquare} title="See who&apos;s stuck">
                Track each student&apos;s progress and answer their questions from one inbox.
              </Feature>
            </ul>
            {!user && (
              <Button asChild variant="outline" className="mt-8">
                <Link href="/register?role=instructor">Start teaching</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function Feature({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-ember-hot">
        <Icon className="size-4" />
      </span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

/** A static rendering of the real learning screen, so visitors see the product rather than an illustration. */
function LearningConsole() {
  const lessons = [
    { t: "Thinking in components", done: true },
    { t: "State and effects", done: true },
    { t: "Server components", done: true },
    { t: "Streaming with Suspense", done: false, active: true },
    { t: "Caching strategies", done: false },
  ];
  return (
    <div className="animate-forge-rise relative [animation-delay:180ms]" aria-hidden>
      <div className="absolute -inset-8 rounded-[2rem] bg-[radial-gradient(60%_60%_at_60%_40%,rgb(255_122_47/.18),transparent)] blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/90 shadow-[0_40px_120px_-40px_rgb(0_0_0/.8)] backdrop-blur">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]/70" />
          <span className="size-2.5 rounded-full bg-[#febc2e]/70" />
          <span className="size-2.5 rounded-full bg-[#28c840]/70" />
          <span className="ml-3 truncate text-xs text-muted-foreground">Modern React · Lesson 4 of 5</span>
        </div>
        <div className="grid sm:grid-cols-[1fr_200px]">
          <div className="p-4">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-[#060917] bg-blueprint">
              <div className="absolute inset-0 grid place-items-center">
                <span className="grid size-14 place-items-center rounded-full bg-heat text-primary-foreground shadow-[0_0_40px_rgb(255_122_47/.5)]">
                  <PlayCircle className="size-7" />
                </span>
              </div>
              <div className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-white/10">
                <div className="h-full w-[42%] rounded-full bg-heat" />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-secondary/60 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 text-xs text-ember-hot">
                <Bot className="size-3.5" /> Forge
              </div>
              <p className="text-foreground/85">
                Suspense lets the shell render first while slower data streams in. Which part of your page would you wrap?
              </p>
            </div>
          </div>
          <div className="border-t border-border p-4 sm:border-t-0 sm:border-l">
            <div className="mb-4 flex items-center gap-3">
              <ForgeRing value={60} size={52} stroke={5} />
              <div className="text-xs text-muted-foreground">3 of 5 done</div>
            </div>
            <ol className="space-y-2.5 text-xs">
              {lessons.map((l) => (
                <li key={l.t} className={`flex items-center gap-2 ${l.active ? "text-foreground" : "text-muted-foreground"}`}>
                  {l.done ? <CheckCircle2 className="size-3.5 text-ember" /> : <Circle className="size-3.5" />}
                  <span className="truncate">{l.t}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
