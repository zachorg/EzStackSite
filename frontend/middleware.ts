import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/playground", "/dashboard"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  const apiKey = req.cookies.get("ezauth_api_key")?.value;
  if (!apiKey) {
    const url = req.nextUrl.clone();
    url.pathname = "/settings";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/playground/:path*", "/dashboard/:path*"],
};


