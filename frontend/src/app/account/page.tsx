"use client";

import { useEffect, useState } from "react";
import { getClientAuth } from "@/lib/firebase/client";

type ApiKeyItem = {
  id: string;
  keyPrefix: string;
  isDefault?: boolean;
  revokedAt?: unknown;
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
  const [modalOpen, setModalOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session/status", { cache: "no-store" });
        const data = await res.json();
        setLoggedIn(Boolean(data?.loggedIn));
      } finally {
        setLoading(false);
      }
    })();
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
        const safe: ApiKeyItem[] = itemsRaw
          .filter(isApiKeyItemLike)
          .map((it) => ({ id: it.id, keyPrefix: it.keyPrefix, isDefault: !!it.isDefault, revokedAt: it.revokedAt }));
        setItems(safe);
      } else {
        setItems([]);
      }
    } catch {}
  }

  useEffect(() => {
    if (loggedIn) refreshList();
  }, [loggedIn]);

  async function generateKey() {
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
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login?redirect=/account";
          return;
        }
        setMessage(data?.error?.message || "Failed to generate key");
      } else {
        setRevealedKey(data?.key || null);
        setModalOpen(true);
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
      if (res.ok) refreshList();
    } catch {}
  }

  async function setDefault(id: string) {
    try {
      const auth = await getClientAuth();
      const user = auth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      const res = await fetch("/api/keys", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) refreshList();
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
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Account settings</h1>
      <div className="space-y-2">
        <p className="text-sm text-foreground/70">Manage your EzStack API key.</p>
        <div className="flex gap-2">
          <button onClick={generateKey} className="px-4 py-2 bg-black text-white rounded">
            Generate API key
          </button>
        </div>
        {message && <p className="text-sm">{message}</p>}
        <div className="mt-4 space-y-2">
          <h2 className="font-medium">Your keys</h2>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="border rounded p-3 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-mono">{it.keyPrefix}••••</div>
                  <div className="text-xs text-foreground/70">
                    {it.isDefault ? "Default • " : ""}
                    {it.revokedAt ? "Revoked" : "Active"}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!it.revokedAt && (
                    <>
                      {!it.isDefault && (
                        <button onClick={() => setDefault(it.id)} className="text-xs px-2 py-1 border rounded">
                          Set default
                        </button>
                      )}
                      <button onClick={() => revokeKey(it.id)} className="text-xs px-2 py-1 border rounded">
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
            {items.length === 0 && <li className="text-sm text-foreground/70">No keys yet.</li>}
          </ul>
        </div>
      </div>
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded p-6 w-[32rem] max-w-full space-y-4">
            <h3 className="text-lg font-semibold">Your new API key</h3>
            <p className="text-sm text-gray-600">
              This key is shown <b>only once</b>. Copy and store it securely. You won’t be able to see it again.
            </p>
            <div className="font-mono break-all border rounded p-3 bg-gray-50">{revealedKey}</div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  if (revealedKey) navigator.clipboard.writeText(revealedKey);
                }}
                className="px-3 py-2 border rounded"
              >
                Copy
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setRevealedKey(null);
                }}
                className="px-3 py-2 bg-black text-white rounded"
              >
                I saved it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}