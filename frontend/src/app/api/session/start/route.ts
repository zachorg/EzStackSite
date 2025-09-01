import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const idToken = String(body?.idToken || "").trim();
    if (!idToken) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "Missing idToken" } },
        { status: 400 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(idToken).catch((e) => {
      throw new Error("verifyIdToken_failed");
    });
    const expiresInMs = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });

    const cookieStore = await cookies();
    cookieStore.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresInMs / 1000),
    });

    return NextResponse.json({ ok: true, uid: decoded.uid });
  } catch (err) {
    const msg =
      err instanceof Error && err.message === "verifyIdToken_failed"
        ? "Invalid or expired Google sign-in token"
        : "Session creation failed";
    const code =
      err instanceof Error && err.message === "verifyIdToken_failed"
        ? "unauthorized"
        : "internal_error";
    const status = code === "unauthorized" ? 401 : 500;
    return NextResponse.json({ error: { code, message: msg } }, { status });
  }
}


