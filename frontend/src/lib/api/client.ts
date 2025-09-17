// Lightweight API client with Supabase ID token auth and typed helpers
// NOTE: Do not log or persist plaintext API keys. Only use keyPrefix beyond creation.

import { supabaseBrowser } from "@/lib/supabase/client";

export type ApiErrorEnvelope = { error?: { message?: string } };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function getIdToken(): Promise<string> {
  const supabase = supabaseBrowser();
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token || "";
  if (!token) throw new ApiError("Login required", 401);
  return token;
}

type Json = Record<string, unknown> | undefined;
type HeaderMap = Record<string, string> | undefined;

async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const idToken = await getIdToken();
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // Fall through with raw text when JSON parse fails
  }
  if (!res.ok) {
    const message =
      (data as ApiErrorEnvelope | undefined)?.error?.message ||
      (typeof text === "string" && text) ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  get<T>(path: string, headers?: HeaderMap): Promise<T> {
    return apiFetch<T>(path, { method: "GET", headers });
  },
  post<T>(path: string, body?: Json, headers?: HeaderMap): Promise<T> {
    return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body ?? {}), headers });
  },
  delete<T>(path: string, body?: Json, headers?: HeaderMap): Promise<T> {
    // Next.js route supports DELETE with a JSON body
    return apiFetch<T>(path, { method: "DELETE", body: JSON.stringify(body ?? {}), headers });
  },
};


