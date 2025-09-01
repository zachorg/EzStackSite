import { NextResponse } from "next/server";

export async function POST() {
  // No-op: plaintext API key cookie is deprecated and removed.
  return NextResponse.json({ ok: true });
}


