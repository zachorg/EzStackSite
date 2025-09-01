"use client";

import { useEffect, useState } from "react";
import { getClientAuth, getGoogleProvider } from "@/lib/firebase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get("redirect");
    if (r) setRedirect(r);
  }, []);

  async function signInGoogle() {
    setLoading(true);
    setMessage(null);
    try {
      const auth = await getClientAuth();
      const provider = await getGoogleProvider();
      const { signInWithPopup } = await import("firebase/auth");
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken(true);
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error?.message || "Failed to create session");
      } else {
        window.location.href = redirect || "/settings";
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Sign-in failed. Check Firebase config env vars."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm text-foreground/70">
        Use your Google account to access the console.
      </p>
      <button
        onClick={signInGoogle}
        disabled={loading}
        className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
      >
        Continue with Google
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}


