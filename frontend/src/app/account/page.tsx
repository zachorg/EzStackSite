"use client";

import { useEffect, useState } from "react";
import { getClientAuth } from "@/lib/firebase/client";

type ApiKeyItem = {
  id: string;
  keyPrefix: string;
  name?: string | null;
  revokedAt?: unknown;
  createdAt?: unknown;
  lastUsedAt?: unknown;
};

function isApiKeyItemLike(v: unknown): v is ApiKeyItem {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.keyPrefix === "string";
}

// Basic account page: generates an API key via backend proxy after verifying session.
export default function AccountPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<ApiKeyItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  function toDate(v: unknown): Date | null {
    if (!v) return null;
    // Firestore Timestamp-like
    if (typeof v === "object" && v !== null) {
      type TimestampLike = { toDate?: () => Date; seconds?: number };
      const ts = v as TimestampLike;
      if (typeof ts.toDate === "function") return ts.toDate();
      if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
    }
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v as string | number);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  function formatRelative(dt: Date | null): string {
    if (!dt) return "Unknown";
    const diffMs = Date.now() - dt.getTime();
    if (diffMs < 0) return "Just now";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session/status", { cache: "no-store" });
        const data = await res.json();
        if (Boolean(data?.loggedIn)) {
          setLoggedIn(true);
        } else {
          try {
            const auth = await getClientAuth();
            if (auth.currentUser) setLoggedIn(true);
          } catch {}
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep loggedIn in sync with Firebase client auth and refresh list on sign-in
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const auth = await getClientAuth();
        const mod = await import("firebase/auth");
        unsub = mod.onAuthStateChanged(auth, (user) => {
          setLoggedIn(!!user);
          if (user) refreshList();
        });
      } catch {}
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  async function refreshList() {
    try {
      const auth = await getClientAuth();
      const user = auth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      const res = await fetch("/api/keys", { headers: { authorization: `Bearer ${idToken}` } });
      const data: unknown = await res.json();
      if (
        res.ok &&
        data &&
        typeof data === "object" &&
        Array.isArray((data as { items?: unknown[] }).items)
      ) {
        const itemsRaw = (data as { items: unknown[] }).items;
        let safe: ApiKeyItem[] = itemsRaw
          .map((u): ApiKeyItem | null => {
            if (!isApiKeyItemLike(u)) return null;
            const r = u as unknown as Record<string, unknown>;
            const name = typeof r.name === "string" ? r.name : null;
            const revokedAt = r.revokedAt as unknown;
            const createdAt = r.createdAt as unknown;
            const lastUsedAt = r.lastUsedAt as unknown;
            return { id: u.id, keyPrefix: u.keyPrefix, name, revokedAt, createdAt, lastUsedAt };
          })
          .filter((x): x is ApiKeyItem => x !== null);
        // Hide revoked keys from the visible list
        safe = safe.filter((it) => !it.revokedAt);
        setItems(safe);
        setMessage(null);
      } else {
        setItems([]);
        const errMsg = (data as { error?: { message?: string } })?.error?.message || `Failed to load keys (status ${res.status})`;
        setMessage(errMsg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "network error";
      setMessage(`Failed to load keys: ${msg}`);
    }
  }

  useEffect(() => {
    if (loggedIn) refreshList();
  }, [loggedIn]);

  async function generateKey(name?: string) {
    setMessage(null);
    try {
      const auth = await getClientAuth();
      const user = auth.currentUser;
      if (!user) {
        window.location.href = "/login?redirect=/account";
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(
          name && name.trim() ? { name: name.trim() } : {}
        )
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login?redirect=/account";
          return;
        }
        const msg = (data as { error?: { message?: string } })?.error?.message || "Failed to generate key";
        setMessage(msg);
      } else {
        // Optimistic add to the list for immediate feedback
        const id = (data as Record<string, unknown>)?.id;
        const keyPrefix = (data as Record<string, unknown>)?.keyPrefix;
        if (typeof id === "string" && typeof keyPrefix === "string") {
          const optimistic: ApiKeyItem = {
            id,
            keyPrefix,
            name: name || null,
            createdAt: new Date(),
            lastUsedAt: null,
          };
          setItems((prev) => [optimistic, ...prev]);
        }
        await refreshList();
      }
    } catch {
      setMessage("Network error");
    }
  }

  async function revokeKey(id: string) {
    try {
      const auth = await getClientAuth();
      const user = auth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      const res = await fetch("/api/keys", {
        method: "DELETE",
        headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        // Optimistically remove from UI
        setItems((prev) => prev.filter((it) => it.id !== id));
        // Then refresh to ensure consistency
        refreshList();
      }
    } catch {}
  }

  if (loading) return <div className="p-6">Loading…</div>;

  if (!loggedIn) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p>You need to sign in to manage your API key.</p>
        <a className="px-4 py-2 bg-black text-white rounded" href="/login?redirect=/account">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Account settings</h1>
      <div className="space-y-2">
        <p className="text-sm text-foreground/70">Manage your EzStack API keys.</p>
        <div className="border rounded">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-medium">API Keys</h2>
            <button onClick={() => setCreateOpen(true)} className="px-3 py-2 bg-black text-white rounded text-sm">+ Create API Key</button>
          </div>
          <div className="px-4 pb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-foreground/60">
                <tr>
                  <th className="text-left font-medium py-2">Name</th>
                  <th className="text-left font-medium py-2">Key</th>
                  <th className="text-left font-medium py-2">Created</th>
                  <th className="text-left font-medium py-2">Last used</th>
                  <th className="text-right font-medium py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it) => (
                  <tr key={it.id} className="align-middle">
                    <td className="py-3 truncate">{it.name || "Unnamed key"}</td>
                    <td className="py-3 font-mono text-foreground/80 truncate">{it.keyPrefix}…</td>
                    <td className="py-3 text-foreground/70">{formatRelative(toDate(it.createdAt))}</td>
                    <td className="py-3 text-foreground/70">{it.lastUsedAt ? formatRelative(toDate(it.lastUsedAt)) : "Never"}</td>
                    <td className="py-3">
                      <div className="flex gap-2 justify-end">
                        {!it.revokedAt && (
                          <button onClick={() => revokeKey(it.id)} className="text-xs px-2 py-1 border rounded">Revoke</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="py-6 text-sm text-foreground/70">No keys yet.</div>
            )}
          </div>
        </div>
        {message && <p className="text-sm">{message}</p>}
      </div>
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded p-6 w-[32rem] max-w-full space-y-4">
            <h3 className="text-lg font-semibold">Create API Key</h3>
            <label className="text-sm text-gray-700">Give your API key a display name.</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. staging or production"
              className="w-full border rounded px-3 py-2"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreateOpen(false)} className="px-3 py-2 border rounded">Cancel</button>
              <button
                onClick={async () => {
                  const name = newName.trim();
                  setCreateOpen(false);
                  setNewName("");
                  await generateKey(name);
                }}
                className="px-3 py-2 bg-black text-white rounded"
              >
                Create API Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}