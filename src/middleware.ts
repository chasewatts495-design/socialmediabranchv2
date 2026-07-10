import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth-token";

// The PWA manifest is fetched by the browser WITHOUT cookies, so it must
// bypass the gate (it contains only the app name/colors/icon path).
const PUBLIC_PATHS = ["/login", "/api/cron/tick", "/manifest.webmanifest"];

export async function middleware(req: NextRequest) {
  // No password configured → gate disabled (local demo use).
  if (!process.env.APP_PASSWORD) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await authToken())) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
