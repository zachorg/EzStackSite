import { NextRequest, NextResponse } from "next/server";

function functionsBaseUrl() {
  const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || process.env.FIREBASE_FUNCTIONS_REGION || "us-central1";
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!project) throw new Error("FIREBASE_PROJECT_ID missing");
  const useEmulator = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR === "true" || process.env.FUNCTIONS_EMULATOR === "true";
  return useEmulator
    ? `http://127.0.0.1:5001/${project}/${region}`
    : `https://${region}-${project}.cloudfunctions.net`;
}

export async function POST(req: NextRequest) {
  const authz = req.headers.get("authorization");
  if (!authz) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  const base = functionsBaseUrl();
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${base}/setDefaultApiKey`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: authz },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

