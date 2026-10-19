import type { Metadata } from "next";
import Link from "next/link";
import { OnAirCard, SessionRows } from "@/components/live/session-list";
import { ScheduleLiveDialog } from "@/components/live/schedule-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getStudio } from "@/lib/data/courses";
import { listLiveForInstructor, listLiveForStudent } from "@/lib/live/sessions";

export const metadata: Metadata = { title: "Live classes" };

export default async function LivePage() {
  const user = await requireUser();
  const host = user.role !== "student";
  const [sessions, studio] = await Promise.all([
    host ? listLiveForInstructor(user) : listLiveForStudent(user.id),
    host ? getStudio(user) : null,
  ]);
  const onAir = sessions.filter((s) => s.status === "live");
  const upcoming = sessions.filter((s) => s.status === "scheduled");
  const past = sessions.filter((s) => s.status === "ended");
  const courses = studio?.courses.map((c) => ({ id: c.id, title: c.title })) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Live classes</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            {host
              ? "Teach in real time. Schedule a class, stream from OBS, Zoom or your phone, and talk with students in the chat."
              : "Join your instructors live, ask questions in the chat and catch up on replays."}
          </p>
        </div>
        {host && courses.length > 0 && <ScheduleLiveDialog courses={courses} />}
      </div>

      {onAir.length > 0 && (
        <section className="mt-10 space-y-4" aria-label="On air now">
          {onAir.map((s) => (
            <OnAirCard key={s.id} session={s} host={host} />
          ))}
        </section>
      )}

      <section className="mt-10" aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-4 font-display text-lg font-medium">Upcoming</h2>
        <SessionRows
          sessions={upcoming}
          host={host}
          empty={
            host ? (
              courses.length ? "Nothing scheduled. Schedule a class and your students are notified right away." : (
                <>
                  Create a course first, then schedule live classes for it.{" "}
                  <Link href="/studio/courses/new" className="text-foreground underline underline-offset-4">New course</Link>
                </>
              )
            ) : (
              "No live classes scheduled in your courses yet. You'll be notified when one is."
            )
          }
        />
      </section>

      <section className="mt-12" aria-labelledby="past">
        <h2 id="past" className="mb-4 font-display text-lg font-medium">{host ? "Past classes" : "Replays"}</h2>
        <SessionRows sessions={past} host={host} empty={host ? "Classes you've finished appear here with their recordings." : "Recordings of past classes appear here."} />
      </section>

      {!host && sessions.length === 0 && (
        <div className="mt-10 text-center">
          <Button asChild variant="outline">
            <Link href="/courses">Find a course to join</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
