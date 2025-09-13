import { api } from "./client";

export type TimestampLike = { seconds: number; nanos?: number } | string | number | null;

export type CreateApiKeyRequest = {
  tenantId: string;
  name?: string;
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
    return api.post<CreateApiKeyResponse>("/api/keys", input);
  },
  list(tenantId: string) {
    const qs = new URLSearchParams({ tenantId }).toString();
    return api.get<ListApiKeysResponse>(`/api/keys?${qs}`);
  },
  revoke(id: string) {
    return api.delete<RevokeApiKeyResponse>("/api/keys", { id });
  },
};


