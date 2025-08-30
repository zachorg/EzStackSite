"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get("redirect");
    if (r) setRedirect(r);
  }, []);

  async function saveKey() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/key/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error?.message || "Failed to save key");
      } else {
        setMessage("Saved.");
        if (redirect) window.location.href = redirect;
      }
    } catch (e) {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/key/clear", { method: "POST" });
      if (!res.ok) {
        setMessage("Failed to clear key");
      } else {
        setMessage("Cleared.");
      }
    } catch (e) {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <label className="block text-sm font-medium">API Key</label>
      <input
        className="w-full border rounded px-3 py-2"
        type="password"
        placeholder="Enter your x-ezauth-key"
        value={apiKeyInput}
        onChange={(e) => setApiKeyInput(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={saveKey}
          disabled={saving || !apiKeyInput}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={clearKey}
          disabled={saving}
          className="px-4 py-2 border rounded"
        >
          Clear
        </button>
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}


