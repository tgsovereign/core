import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const loggedIn = request.cookies.get("logged_in")?.value;
  const { pathname } = request.nextUrl;

  // Logged-in users hitting the login page → redirect to /chat
  if (pathname === "/" && loggedIn) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // Unauthenticated users hitting /chat → redirect to login
  if (pathname.startsWith("/chat") && !loggedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/chat/:path*"],
};
