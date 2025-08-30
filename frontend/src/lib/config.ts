export const EZAUTH_BASE_URL = process.env.EZAUTH_BASE_URL || "http://localhost:8080";

export const EZAUTH_API_VERSION = "/v1";

export const COOKIE_NAMES = {
  apiKey: "ezauth_api_key",
} as const;

export function getBackendUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${EZAUTH_BASE_URL}${trimmed}`;
}


