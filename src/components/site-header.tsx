import Link from "next/link";
import { BookOpen, GraduationCap, Inbox, LayoutDashboard, LogOut, PenTool } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLink } from "@/components/nav-link";
import { logoutAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth/dal";
import { initials } from "@/lib/format";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const teaching = user && user.role !== "student";
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo href={user ? (teaching ? "/studio" : "/dashboard") : "/"} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <NavLink href="/courses">Catalog</NavLink>
          {user && !teaching && <NavLink href="/dashboard">My learning</NavLink>}
          {teaching && <NavLink href="/studio">Studio</NavLink>}
          {teaching && <NavLink href="/studio/inbox">Inbox</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Account menu">
                  <Avatar className="size-9 border border-border">
                    <AvatarFallback className="bg-secondary font-display text-[11px]">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {teaching ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/studio"><LayoutDashboard /> Studio</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/studio/courses/new"><PenTool /> New course</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/studio/inbox"><Inbox /> Inbox</Link>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard"><GraduationCap /> My learning</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild className="md:hidden">
                  <Link href="/courses"><BookOpen /> Catalog</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full"><LogOut /> Sign out</button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="bg-heat font-semibold">
                <Link href="/register">Start learning</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
