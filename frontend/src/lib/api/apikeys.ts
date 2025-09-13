import { api } from "./client";

export type TimestampLike = { seconds: number; nanos?: number } | string | number | null;

export type CreateApiKeyRequest = {
  name?: string;
  scopes?: string[];
  demo?: boolean;
};

export type CreateApiKeyResponse = {
  id: string;
  key: string; // plaintext; must only be displayed once
  keyPrefix: string;
  name: string | null;
  createdAt: TimestampLike | null;
  lastUsedAt: TimestampLike | null;
};

export type ListApiKeysResponse = {
  items: Array<{
    id: string;
    name: string | null;
    keyPrefix: string;
    createdAt: TimestampLike | null;
    lastUsedAt: TimestampLike | null;
    revokedAt: TimestampLike | null;
  }>;
};

export type RevokeApiKeyRequest = { id: string };
export type RevokeApiKeyResponse = { ok: true; deleted: true };

export const apiKeys = {
  create(input: CreateApiKeyRequest) {
    // Use local Next.js route to carry Authorization securely
    return api.post<CreateApiKeyResponse>("/api/keys", input);
  },
  list() {
    return api.get<ListApiKeysResponse>("/api/keys");
  },
  revoke(id: string) {
    return api.delete<RevokeApiKeyResponse>("/api/keys", { id });
  },
};


