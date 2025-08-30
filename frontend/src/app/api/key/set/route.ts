import { NextResponse } from "next/server";
import { setApiKeyCookie } from "@/lib/cookies";
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

    await setApiKeyCookie(value);

    // If logged in, also store to Firestore
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("__session")?.value;
      if (sessionCookie) {
        const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
        await db.collection("users").doc(decoded.uid).set({ apiKey: value }, { merge: true });
      }
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }
}


