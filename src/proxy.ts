import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "@/lib/auth/session";

// Optimistic gate only: pages and actions re-verify the session against the database.
const PROTECTED = ["/dashboard", "/learn", "/studio"];
const AUTH_PAGES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/studio") && session?.role === "student") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (AUTH_PAGES.includes(pathname) && session) {
    return NextResponse.redirect(new URL(session.role === "student" ? "/dashboard" : "/studio", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/learn/:path*", "/studio/:path*", "/login", "/register"],
};
