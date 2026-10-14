import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { Input } from "@/components/ui/input";
import { listCatalog, listCategories } from "@/lib/data/courses";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Course catalog" };

export default async function CatalogPage({ searchParams }: PageProps<"/courses">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const [courses, categories] = await Promise.all([listCatalog({ q, category }), listCategories()]);

  const chip = (label: string, value: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("category", value);
    const active = category === value;
    return (
      <Link
        key={label}
        href={`/courses${params.size ? `?${params}` : ""}`}
        aria-current={active ? "true" : undefined}
        className={cn(
          "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
          active ? "border-ember/60 bg-ember/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Catalog</h1>
          <p className="mt-2 text-muted-foreground">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
            {q && <> matching “{q}”</>}
            {category && <> in {category}</>}
          </p>
        </div>
        <form className="relative w-full md:w-80" role="search">
          {category && <input type="hidden" name="category" value={category} />}
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search courses" aria-label="Search courses" className="h-10 pl-9" />
        </form>
      </div>

      {categories.length > 1 && (
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Categories">
          {chip("All", "")}
          {categories.map((c) => chip(c, c))}
        </nav>
      )}

      {courses.length ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => (
            <CourseCard key={c.id} course={c} priority={i < 3} />
          ))}
        </div>
      ) : (
        <div className="mt-16 rounded-xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">No courses match that search.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a broader term, or clear the filters.</p>
          <Link href="/courses" className="mt-4 inline-block text-sm text-ember-hot underline underline-offset-4">
            Clear filters
          </Link>
        </div>
      )}
    </div>
  );
}
