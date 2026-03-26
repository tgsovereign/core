import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // Logged-in users hitting the login page → redirect to /chat
  if (pathname === "/" && token) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // Unauthenticated users hitting /chat → redirect to login
  if (pathname.startsWith("/chat") && !token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/chat/:path*"],
};
