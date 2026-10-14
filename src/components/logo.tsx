import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  // An anvil-like chevron struck by a spark: the forge.
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <defs>
        <linearGradient id="lm-heat" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--ember)" />
          <stop offset="1" stopColor="var(--ember-hot)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--steel-2)" stroke="var(--rule)" />
      <path d="M8 21.5h16l-3.2-4.5H11.2z" fill="url(#lm-heat)" />
      <path d="M12 14.5 16 8l4 6.5" fill="none" stroke="var(--frost)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="6" r="1.4" fill="var(--ember-hot)" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 rounded-md", className)} aria-label="EduForge home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span className="font-display text-[15px] font-semibold tracking-tight">EduForge</span>
    </Link>
  );
}
