import Image from "next/image";
import { cn } from "@/lib/utils";

// Deterministic generative cover when an instructor hasn't uploaded one.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function CourseCover({
  id,
  title,
  category,
  url,
  className,
  priority,
}: {
  id: string;
  title: string;
  category: string;
  url?: string | null;
  className?: string;
  priority?: boolean;
}) {
  if (url) {
    return (
      <div className={cn("relative overflow-hidden bg-secondary", className)}>
        <Image
          src={url}
          alt=""
          fill
          sizes="(min-width: 1024px) 400px, 100vw"
          className="object-cover"
          priority={priority}
          unoptimized={url.startsWith("/api/")}
        />
      </div>
    );
  }
  const h = hash(id);
  const angle = h % 360;
  const x = 20 + (h % 60);
  const rings = 3 + (h % 4);
  return (
    <div className={cn("relative overflow-hidden bg-[var(--steel-2)] bg-blueprint", className)} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at ${x}% 110%, rgb(255 122 47 / .35), transparent 55%), linear-gradient(${angle}deg, transparent 40%, rgb(124 140 255 / .12))`,
        }}
      />
      <svg className="absolute -right-8 -bottom-10 h-[140%] opacity-60" viewBox="0 0 200 200">
        {Array.from({ length: rings }, (_, i) => (
          <circle key={i} cx="100" cy="100" r={30 + i * 18} fill="none" stroke="var(--frost)" strokeOpacity={0.08 + i * 0.02} />
        ))}
        <circle cx="100" cy="100" r="30" fill="none" stroke="var(--ember)" strokeWidth="2" strokeDasharray={`${40 + (h % 120)} 400`} />
      </svg>
      <span className="absolute top-3 left-3 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-frost/80 backdrop-blur">
        {category}
      </span>
      <span className="sr-only">{title}</span>
    </div>
  );
}
