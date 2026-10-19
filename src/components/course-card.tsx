import Link from "next/link";
import { Layers, Star, Users } from "lucide-react";
import { CourseCover } from "@/components/course-cover";
import { LEVEL_LABEL } from "@/lib/format";
import type { Level } from "@/lib/db/schema";

export type CourseCardData = {
  id: string;
  title: string;
  summary: string;
  category: string;
  level: Level;
  coverUrl: string | null;
  instructorName: string;
  lessonCount: number;
  studentCount: number;
  ratingAvg?: number;
  ratingCount?: number;
};

export function CourseCard({ course, priority }: { course: CourseCardData; priority?: boolean }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card outline-none transition-colors hover:border-[color-mix(in_oklch,var(--ember),var(--rule)_60%)] focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <CourseCover
        id={course.id}
        title={course.title}
        category={course.category}
        url={course.coverUrl}
        priority={priority}
        className="aspect-[16/9]"
      />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-display text-base leading-snug font-medium text-balance group-hover:text-white">
          {course.title}
        </h3>
        {course.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{course.summary}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs text-muted-foreground">
          <span className="text-foreground/80">{course.instructorName}</span>
          <span className="inline-flex items-center gap-1"><Layers className="size-3.5" />{course.lessonCount} lessons</span>
          <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{course.studentCount}</span>
          {course.ratingCount ? (
            <span className="inline-flex items-center gap-1" aria-label={`Rated ${course.ratingAvg} out of 5 by ${course.ratingCount} learners`}>
              <Star className="size-3.5 fill-ember-hot text-ember-hot" />
              <span className="text-foreground/80 tabular-nums">{course.ratingAvg?.toFixed(1)}</span>
              <span>({course.ratingCount})</span>
            </span>
          ) : null}
          <span className="ml-auto rounded-full border border-border px-2 py-0.5">{LEVEL_LABEL[course.level]}</span>
        </div>
      </div>
    </Link>
  );
}
