"use client";

import { useEffect, useState } from "react";
import { getClientAuth, getGoogleProvider } from "@/lib/firebase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get("redirect");
    if (r) setRedirect(r);
  }, []);

  // Sign in with Google using a popup, then exchange the ID token for a session cookie.
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
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.error?.detail ? ` (${data.error.detail})` : "";
        setMessage((data?.error?.message || "Failed to create session") + detail);
      } else {
        window.location.href = redirect || "/";
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Sign-in failed. Check Firebase config env vars."
      );
    } finally {
      setLoading(false);
    }
  }

  // Helper to exchange the currently signed-in Firebase user for a server session.
  async function startSessionWithCurrentUser() {
    const auth = await getClientAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No authenticated user");
    const idToken = await currentUser.getIdToken(true);
    const res = await fetch("/api/session/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      const detail = data?.error?.detail ? ` (${data.error.detail})` : "";
      throw new Error((data?.error?.message || "Failed to create session") + detail);
    }
  }

  // Create an account with email/password and start a session.
  async function signUpWithEmailPassword() {
    setLoading(true);
    setMessage(null);
    try {
      const auth = await getClientAuth();
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      await startSessionWithCurrentUser();
      window.location.href = redirect || "/";
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Account creation failed. Check email and password."
      );
    } finally {
      setLoading(false);
    }
  }

  // Sign in with email/password and start a session.
  async function signInWithEmailPassword() {
    setLoading(true);
    setMessage(null);
    try {
      const auth = await getClientAuth();
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await startSessionWithCurrentUser();
      window.location.href = redirect || "/";
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Sign-in failed. Check your credentials."
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
      <div className="pt-4 space-y-2">
        <p className="text-sm text-foreground/70">Or use email and password</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2 border rounded"
          disabled={loading}
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          className="w-full px-3 py-2 border rounded"
          disabled={loading}
          autoComplete="current-password"
        />
        <div className="flex gap-2">
          <button
            onClick={signUpWithEmailPassword}
            disabled={loading || !email || !password}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Create account
          </button>
          <button
            onClick={signInWithEmailPassword}
            disabled={loading || !email || !password}
            className="px-4 py-2 bg-gray-900 text-white rounded disabled:opacity-50"
          >
            Sign in
          </button>
        </div>
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}


