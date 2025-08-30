import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) return NextResponse.json({ loggedIn: false });
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return NextResponse.json({ loggedIn: true, uid: decoded.uid });
  } catch {
    return NextResponse.json({ loggedIn: false });
  }
}


