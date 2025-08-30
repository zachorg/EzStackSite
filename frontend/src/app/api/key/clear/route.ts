import { NextResponse } from "next/server";
import { clearApiKeyCookie } from "@/lib/cookies";

export async function POST() {
  await clearApiKeyCookie();
  return NextResponse.json({ ok: true });
}


