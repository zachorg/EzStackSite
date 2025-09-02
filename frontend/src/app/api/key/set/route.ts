import { NextResponse } from "next/server";
import { adminAuth, db } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const value = String(body?.apiKey || "").trim();
    if (!value) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "apiKey is required" } },
        { status: 400 }
      );
    }

    // Deprecated: do not store plaintext keys anywhere or in cookies.
    // If logged in, you may persist only minimal metadata.
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("__session")?.value;
      if (sessionCookie) {
        const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
        await db
          .collection("users")
          .doc(decoded.uid)
          .set({ lastClientEnteredKeyAt: new Date().toISOString() }, { merge: true });
      }
    } catch {}
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }
}


