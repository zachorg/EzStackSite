import { NextRequest, NextResponse } from "next/server";

// Resolve the Cloud Functions base URL. Uses emulator if NEXT_PUBLIC_FUNCTIONS_EMULATOR=true.
export function functionsBaseUrl(): string {
  const region = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "us-central1";
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!project) throw new Error("Missing env NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const useEmulator = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR === "true";
  return useEmulator
    ? `http://127.0.0.1:5001/${project}/${region}`
    : `https://${region}-${project}.cloudfunctions.net`;
}

type HttpMethod = "GET" | "POST";

// Minimal proxy that forwards auth header to Cloud Functions and returns JSON responses.
async function forward(method: HttpMethod, fnPath: string, req: NextRequest) {
  const authz = req.headers.get("authorization");
  if (!authz) return NextResponse.json({ error: { code: "unauthorized", message: "Login required" } }, { status: 401 });
  try {
    const base = functionsBaseUrl();
    const init: RequestInit = {
      method,
      headers: { "content-type": "application/json", authorization: authz },
      cache: "no-store",
    };
    if (method === "POST") {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      (init as RequestInit & { body?: string }).body = JSON.stringify(body ?? {});
    }
    const url = `${base}${fnPath}`;
    const res = await fetch(url, init);
    const text = await res.text();
    let data: unknown = {};
    try { data = JSON.parse(text); } catch { data = { error: { message: text?.slice(0, 500) || "" } } as unknown; }
    return NextResponse.json(data, { status: res.status, headers: { 'x-proxy-target': url } });
  } catch (err) {
    const msg = typeof (err as { message?: unknown })?.message === "string" ? (err as { message: string }).message : "Proxy error";
    if (process.env.NODE_ENV !== 'production') {
      // Dev-only logging to help debug proxy failures
      // Avoid logging tokens or sensitive request bodies
      console.warn("functions proxy error", { fnPath, msg });
    }
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}

export function proxyGet(fnPath: string, req: NextRequest) {
  return forward("GET", fnPath, req);
}

export function proxyPost(fnPath: string, req: NextRequest) {
  return forward("POST", fnPath, req);
}


