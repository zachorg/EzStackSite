import { NextResponse } from "next/server";
import { adminAuth, db } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

function createPseudoApiKey(sessionId: string): string {
  // Simple pseudo key for demo; replace with backend call in production
  const base = Buffer.from(`${sessionId}:${Date.now()}`).toString("base64url");
  return `ez_${base}`;
}

export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required" } },
      { status: 401 }
    );
  }

  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  const apiKey = createPseudoApiKey(decoded.uid);

  // Do not store plaintext API keys. Persist only metadata.
  await db
    .collection("users")
    .doc(decoded.uid)
    .set(
      {
        lastGeneratedKeyAt: new Date().toISOString(),
      },
      { merge: true }
    );

  // Return key once to the caller to display. Caller should avoid storing plaintext.
  return NextResponse.json({ ok: true, apiKey });
}


