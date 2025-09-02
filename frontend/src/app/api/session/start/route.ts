// Creates a signed session cookie from a Firebase ID token.
// Called after client completes Google or Email/Password sign-in.
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

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

    let decoded: import("firebase-admin/auth").DecodedIdToken;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Invalid or expired sign-in token" } },
        { status: 401 }
      );
    }
    const expiresInMs = 60 * 60 * 24 * 5 * 1000; // 5 days
    let sessionCookie: string;
    try {
      sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });
    } catch (e) {
      const isDev = process.env.NODE_ENV !== "production";
      const detail = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          error: {
            code: "internal_error",
            message: "Session creation failed",
            ...(isDev ? { detail } : {}),
          },
        },
        { status: 500 }
      );
    }

    const res = NextResponse.json({ ok: true, uid: decoded.uid });
    res.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresInMs / 1000),
    });

    return res;
  } catch (err) {
    const isDev = process.env.NODE_ENV !== "production";
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: {
          code: "internal_error",
          message: "Session creation failed",
          ...(isDev ? { detail } : {}),
        },
      },
      { status: 500 }
    );
  }
}


