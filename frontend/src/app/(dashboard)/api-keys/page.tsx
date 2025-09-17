"use client";

import { useEffect, useMemo, useState } from "react";
import { apiKeys, type CreateApiKeyRequest, type ListApiKeysResponse } from "@/lib/api/apikeys";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type KeyItem = ListApiKeysResponse["items"][number];

function formatDate(value: KeyItem["createdAt"]) {
  if (!value) return "—";
  try {
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(Number(value));
      if (!isNaN(d.getTime())) return d.toLocaleString();
    } else if (typeof value === "object" && value && "seconds" in value) {
      const secs = Number((value as { seconds: number }).seconds) * 1000;
      if (!isNaN(secs)) return new Date(secs).toLocaleString();
    }
  } catch {}
  return "—";
}

function useKeys(tenantId: string | null) {
  const [items, setItems] = useState<KeyItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiKeys.list(tenantId);
      setItems(res.items ?? []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  return { items, loading, error, reload };
}

function CreateKeySection({ tenantId, onCreated, disabled, existingNames }: { tenantId: string | null; onCreated: (opts: { key: string; keyPrefix: string }) => void; disabled?: boolean; existingNames?: string[] }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedExisting = (existingNames || []).map((n) => n.trim().toLowerCase()).filter(Boolean);
  const trimmed = name.trim();
  const isDuplicate = trimmed ? normalizedExisting.includes(trimmed.toLowerCase()) : false;
  const canSubmit = !submitting && !disabled && !isDuplicate;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let resolvedTenantId = tenantId;
      if (!resolvedTenantId) {
        try {
          const { supabaseBrowser } = await import("@/lib/supabase/client");
          const supabase = supabaseBrowser();
          const { data } = await supabase.auth.getUser();
          resolvedTenantId = data.user?.id ?? null;
        } catch {}
      }
      if (!resolvedTenantId) {
        setError("Sign in to create a key");
        return;
      }
      const payload: CreateApiKeyRequest = {
        tenantId: resolvedTenantId,
        name: trimmed ? trimmed.slice(0, 120) : undefined,
      };
      const res = await apiKeys.create(payload);
      // Do not log or persist res.key
      onCreated({ key: res.key, keyPrefix: res.keyPrefix });
      setName("");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create key";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="create-key-heading" className="space-y-3">
      <h2 id="create-key-heading" className="text-lg font-semibold">Create API key</h2>
      {error ? (
        <div role="alert" aria-live="assertive" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="key-name" className="block text-sm font-medium">Name (optional)</label>
          <input
            id="key-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            aria-invalid={isDuplicate}
            className={cn("mt-1 w-full rounded border px-2 py-1", isDuplicate ? "border-red-500" : "")}
            placeholder="e.g., CI Deploy Key"
          />
          {isDuplicate ? (
            <p className="mt-1 text-xs text-red-600">This name is already used</p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
            disabled={!canSubmit}
            aria-busy={submitting}
          >
            {submitting ? "Creating…" : "Create key"}
          </button>
        </div>
      </form>
    </section>
  );
}

function KeysTable({ items, onRevoke, revokingId }: { items: KeyItem[]; onRevoke: (item: KeyItem) => void; revokingId?: string | null }) {
  if (!items.length) {
    return (
      <div className="rounded border p-6 text-center">
        <p className="text-sm">No API keys yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="text-left text-sm">
            <th className="border-b px-3 py-2 font-medium">Name</th>
            <th className="border-b px-3 py-2 font-medium">Key Prefix</th>
            <th className="border-b px-3 py-2 font-medium">Created</th>
            <th className="border-b px-3 py-2 font-medium">Last Used</th>
            <th className="border-b px-3 py-2 font-medium">Status</th>
            <th className="border-b px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isRevoked = Boolean(item.revokedAt);
            return (
              <tr key={item.id} className="text-sm">
                <td className="border-b px-3 py-2">{item.name || "—"}</td>
                <td className="border-b px-3 py-2 font-mono">{item.keyPrefix}</td>
                <td className="border-b px-3 py-2">{formatDate(item.createdAt)}</td>
                <td className="border-b px-3 py-2">{formatDate(item.lastUsedAt)}</td>
                <td className="border-b px-3 py-2">
                  <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs", isRevoked ? "bg-gray-200 text-gray-700" : "bg-green-100 text-green-800")}>
                    {isRevoked ? "Revoked" : "Active"}
                  </span>
                </td>
                <td className="border-b px-3 py-2 text-right">
                  {!isRevoked ? (
                    <button
                      className="rounded border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
                      onClick={() => onRevoke(item)}
                      disabled={revokingId === item.id}
                    >
                      {revokingId === item.id ? "Revoking…" : "Revoke"}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RevokeDialog({ open, keyPrefix, onConfirm, onCancel }: { open: boolean; keyPrefix: string | null; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded bg-white p-4 shadow">
        <h3 className="text-base font-semibold">Revoke API key</h3>
        <p className="mt-2 text-sm">Revoke key {keyPrefix ? <code className="font-mono">{keyPrefix}</code> : null}? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded border px-3 py-2 text-sm" onClick={onCancel}>Cancel</button>
          <button className="rounded bg-red-600 px-3 py-2 text-sm text-white" onClick={onConfirm}>Revoke</button>
        </div>
      </div>
    </div>
  );
}

function CreatedKeyPanel({ keyValue, keyPrefix, onDismiss }: { keyValue: string; keyPrefix: string; onDismiss: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const display = useMemo(() => (revealed ? keyValue : "•".repeat(Math.min(keyValue.length, 24)) + " …"), [revealed, keyValue]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-4">
      <h3 className="text-base font-semibold">New API key created</h3>
      <p className="mt-1 text-sm text-amber-900">This key is shown once. Store it securely. We can’t show it again.</p>
      <div className="mt-3 flex items-center gap-2">
        <code className="block grow rounded border bg-white px-2 py-1 font-mono text-sm" aria-label="API key value">{display}</code>
        <button className="rounded border px-2 py-1 text-sm" onClick={() => setRevealed((v) => !v)} aria-pressed={revealed} aria-label={revealed ? "Hide key" : "Show key"}>
          {revealed ? "Hide" : "Show"}
        </button>
        <button className="rounded border px-2 py-1 text-sm" onClick={onCopy} aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-700">Key prefix: <code className="font-mono">{keyPrefix}</code></p>
      <div className="mt-3">
        <button className="rounded bg-black px-3 py-2 text-sm text-white" onClick={onDismiss}>Done</button>
      </div>
    </div>
  );
}

function useTenantSelection() {
  // Simplified: tenant is the signed-in user by default.
  const [tenantId, setTenantId] = useState<string | null>(null);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const { supabaseBrowser } = await import("@/lib/supabase/client");
        const supabase = supabaseBrowser();
        try { await fetch("/api/tenants/bootstrap", { method: "POST", cache: "no-store" }); } catch {}
        const { data: initial } = await supabase.auth.getUser();
        setTenantId(initial.user?.id ?? null);
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          setTenantId(session?.user?.id ?? null);
        });
        unsub = () => subscription.unsubscribe();
      } catch {
        setTenantId(null);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, []);
  return { tenantId };
}

export default function ApiKeysPage() {
  const { tenantId } = useTenantSelection();
  const { items, loading, error, reload } = useKeys(tenantId);
  const [created, setCreated] = useState<{ key: string; keyPrefix: string } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; keyPrefix: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Roles are not needed with single-tenant-per-user simplification

  const onCreated = (k: { key: string; keyPrefix: string }) => {
    // Show the key panel first; refresh the list after user dismisses
    setCreated(k);
  };

  const onRevokeRequested = (item: KeyItem) => {
    setConfirm({ id: item.id, keyPrefix: item.keyPrefix });
  };

  const doRevoke = async () => {
    if (!confirm) return;
    setActionError(null);
    setRevokingId(confirm.id);
    try {
      await apiKeys.revoke(confirm.id, tenantId ?? undefined);
      setConfirm(null);
      await reload();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to revoke";
      setActionError(msg);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold">API Keys</h1>
      </header>

      {/* Tenant is the signed-in user; no selector needed */}

      <CreateKeySection
        tenantId={tenantId}
        onCreated={onCreated}
        disabled={!tenantId}
        existingNames={(items || []).map((it) => (it.name || "").trim()).filter(Boolean)}
      />

      {created ? (
        <CreatedKeyPanel
          keyValue={created.key}
          keyPrefix={created.keyPrefix}
          onDismiss={() => {
            void reload();
            setCreated(null);
          }}
        />
      ) : null}

      <section aria-labelledby="keys-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="keys-heading" className="text-lg font-semibold">Your keys</h2>
          <button className="rounded border px-3 py-2 text-sm" onClick={() => reload()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
        {error ? (
          <div role="alert" aria-live="assertive" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}
        {actionError ? (
          <div role="alert" aria-live="assertive" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
        ) : null}
        {items ? (
          <KeysTable items={items} onRevoke={onRevokeRequested} revokingId={revokingId} />
        ) : (
          <div className="text-sm text-gray-600">{loading ? "Loading…" : ""}</div>
        )}
      </section>

      <RevokeDialog
        open={Boolean(confirm)}
        keyPrefix={confirm?.keyPrefix ?? null}
        onCancel={() => setConfirm(null)}
        onConfirm={doRevoke}
      />
    </main>
  );
}


