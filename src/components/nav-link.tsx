"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/studio" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground after:absolute after:inset-x-3 after:-bottom-[13px] after:h-px after:bg-heat",
      )}
    >
      {children}
    </Link>
  );
}
