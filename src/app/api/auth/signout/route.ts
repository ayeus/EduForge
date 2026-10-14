import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Clears a session whose user no longer exists, then sends them to sign in.
export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
