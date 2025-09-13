import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) {
    url.pathname = "/login";
    url.searchParams.set("redirect", "/api-keys");
    return NextResponse.redirect(url);
  }
  try {
    await adminAuth.verifySessionCookie(sessionCookie, true);
    url.pathname = "/api-keys";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  } catch {
    url.pathname = "/login";
    url.searchParams.set("redirect", "/api-keys");
    return NextResponse.redirect(url);
  }
}


