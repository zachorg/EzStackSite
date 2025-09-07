"use client";

import { useEffect, useRef, useState } from "react";
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
  const [showPlainKey, setShowPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  // Validate new API key name: required and unique among existing (non-revoked) keys
  const trimmedNewName = newName.trim();
  const nameDuplicate = trimmedNewName
    ? items.some((it) => (it.name || "").trim().toLowerCase() === trimmedNewName.toLowerCase())
    : false;
  const nameError: string | null = !trimmedNewName
    ? "Name is required"
    : nameDuplicate
    ? "This name is already used"
    : null;

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

  // Fetch the latest API keys for the logged-in user
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

  // Create a new API key. UI is updated optimistically.
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
      // Insert a temporary row immediately for instant UX
      const tempId = `temp-${Date.now()}`;
      const tempItem: ApiKeyItem = {
        id: tempId,
        keyPrefix: "",
        name: name || null,
        createdAt: new Date(),
        lastUsedAt: null,
      };
      setItems((prev) => [tempItem, ...prev]);

      // Kick off the request; update or rollback when it returns
      (async () => {
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
        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = "/login?redirect=/account";
            return;
          }
          const msg = (data as { error?: { message?: string } })?.error?.message || "Failed to generate key";
          setMessage(msg);
          // Roll back temp row
          setItems((prev) => prev.filter((it) => it.id !== tempId));
          return;
        }
        const newId = (data as Record<string, unknown>)?.id;
        const newPrefix = (data as Record<string, unknown>)?.keyPrefix;
        const plaintext = (data as Record<string, unknown>)?.key;
        if (typeof newId === "string" && typeof newPrefix === "string") {
          // Replace temp row with real one
          setItems((prev) => prev.map((it) => it.id === tempId ? { ...it, id: newId, keyPrefix: newPrefix } : it));
        } else {
          // If response missing fields, just refresh
          setItems((prev) => prev.filter((it) => it.id !== tempId));
        }
        if (typeof plaintext === "string" && plaintext) {
          setShowPlainKey(plaintext);
        }
        // Keep data fresh without blocking UI
        refreshList();
      })();
    } catch {
      setMessage("Network error");
    }
  }

  // Revoke a key by id. UI updates optimistically and then refreshes.
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
      // Optimistically remove immediately for instant UX
      setItems((prev) => prev.filter((it) => it.id !== id));
      // Keep data fresh regardless of server outcome
      refreshList();
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
              className={`w-full border rounded px-3 py-2 ${nameError ? "border-red-500" : ""}`}
              aria-invalid={Boolean(nameError)}
            />
            <div className="h-5">
              {nameError && <p className="text-xs text-red-600">{nameError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreateOpen(false)} className="px-3 py-2 border rounded">Cancel</button>
              <button
                onClick={async () => {
                  const name = newName.trim();
                  if (nameError) return;
                  setCreateOpen(false);
                  setNewName("");
                  await generateKey(name);
                }}
                disabled={Boolean(nameError)}
                className={`px-3 py-2 rounded text-white ${nameError ? "bg-black/50 cursor-not-allowed" : "bg-black"}`}
              >
                Create API Key
              </button>
            </div>
          </div>
        </div>
      )}
      {showPlainKey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded p-6 w-[32rem] max-w-full space-y-4">
            <h3 className="text-lg font-semibold">Your new API key</h3>
            <p className="text-sm text-gray-700">Copy and store it now. You won't be able to see it again.</p>
            <div className="flex items-center gap-2">
              <input
                value={showPlainKey}
                readOnly
                className="flex-1 border rounded px-3 py-2 font-mono"
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(showPlainKey);
                    if (copyTimerRef.current) {
                      window.clearTimeout(copyTimerRef.current);
                    }
                    setCopied(true);
                    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
                  } catch {}
                }}
                className={`px-3 py-2 border rounded transition-colors ${copied ? "bg-green-600 text-white border-green-600" : ""}`}
                title={copied ? "Copied!" : "Copy to clipboard"}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={() => { setShowPlainKey(null); setCopied(false); if (copyTimerRef.current) { window.clearTimeout(copyTimerRef.current); copyTimerRef.current = null; } }} className="px-3 py-2 bg-black text-white rounded">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}