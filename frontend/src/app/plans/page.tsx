"use client";

import { useState } from "react";

type Plan = { id: string; name: string; price: string; features: string[] };

const plans: Plan[] = [
  { id: "free", name: "Free", price: "$0", features: ["Dev only", "Low limits"] },
  { id: "pro", name: "Pro", price: "$19/mo", features: ["Higher limits", "Email/SMS OTP"] },
  { id: "scale", name: "Scale", price: "$99/mo", features: ["High limits", "Priority queueing"] },
];

export default function PlansPage() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function startCheckout(planId: string) {
    setLoadingId(planId);
    setMsg(null);
    try {
      if (planId === "free") {
        setMsg("Free plan activated.");
        setLoadingId(null);
        return;
      }
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setMsg(data?.error?.message || "Checkout failed");
      } else {
        window.location.href = data.url;
      }
    } catch (e) {
      setMsg("Network error");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Choose a plan</h1>
      {msg && <p className="mb-4 text-sm text-gray-600">{msg}</p>}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div key={p.id} className="border rounded p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <span className="text-sm text-gray-600">{p.price}</span>
            </div>
            <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button
              onClick={() => startCheckout(p.id)}
              disabled={!!loadingId}
              className="mt-4 w-full px-4 py-2 bg-black text-white rounded disabled:opacity-50"
            >
              {p.id === "free" ? "Activate" : "Select"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


