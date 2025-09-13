import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, db } from "@/lib/firebase/admin";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: { message: "Login required" } }, { status: 401 });
    }
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;

    const tenantRef = db.collection("tenants").doc(uid);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      await tenantRef.set({ status: "active", createdAt: new Date(), createdBy: uid }, { merge: true });
    }
    const memberRef = tenantRef.collection("members").doc(uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      await memberRef.set({ role: "owner", addedAt: new Date() }, { merge: true });
    }
    return NextResponse.json({ ok: true, tenantId: uid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bootstrap error";
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}


