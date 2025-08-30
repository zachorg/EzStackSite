import { NextResponse } from "next/server";
import { setApiKeyCookie } from "@/lib/cookies";
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

  // Persist in Firestore per user
  await db.collection("users").doc(decoded.uid).set({ apiKey }, { merge: true });
  await setApiKeyCookie(apiKey);

  return NextResponse.json({ ok: true, apiKey });
}


