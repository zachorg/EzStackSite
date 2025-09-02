"use client";

import { useEffect, useState } from "react";
import { getClientAuth } from "@/lib/firebase/client";

// Basic account page: generates an API key via backend proxy after verifying session.
export default function AccountPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

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
      const res = await fetch("/api/proxy/key/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login?redirect=/account";
          return;
        }
        setMessage(data?.error?.message || "Failed to generate key");
      } else {
        setMessage("API key generated. It is shown once; store it securely.");
      }
    } catch {
      setMessage("Network error");
    }
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
      </div>
    </div>
  );
}