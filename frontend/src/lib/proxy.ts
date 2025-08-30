import { NextRequest } from "next/server";
import { getBackendUrl } from "./config";
import { cookies } from "next/headers";

export async function proxyJsonPost(req: NextRequest, path: string): Promise<Response> {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get("ezauth_api_key")?.value;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { code: "unauthorized", message: "Missing API key" } }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  const idempotency = req.headers.get("idempotency-key") || undefined;
  const body = await req.text();

  const upstream = await fetch(getBackendUrl(path), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ezauth-key": apiKey,
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body,
    // Keep credentials off; we forward only necessary headers
  });

  // Forward response as-is including rate-limit headers if present
  const resHeaders = new Headers();
  resHeaders.set("content-type", upstream.headers.get("content-type") || "application/json");
  const forwardHeaderNames = [
    "retry-after",
    "x-ratelimit-reset",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
  ];
  for (const h of forwardHeaderNames) {
    const v = upstream.headers.get(h);
    if (v) resHeaders.set(h, v);
  }

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}


