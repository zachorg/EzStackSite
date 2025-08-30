import { NextResponse } from "next/server";
import { setApiKeyCookie } from "@/lib/cookies";

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
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }
}


