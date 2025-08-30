"use client";

import { useState } from "react";

type ErrorShape = { error?: { code?: string; message?: string } };

export default function PlaygroundPage() {
  const [destination, setDestination] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("email");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [cooldownMsg, setCooldownMsg] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [isOTP, setIsOTP] = useState(true);
  const [loading, setLoading] = useState(false);

  function appendLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 200));
  }

  async function send() {
    setLoading(true);
    setCooldownMsg(null);
    try {
      const path = isOTP ? "/api/otp/send" : "/api/ote/send";
      const body = isOTP
        ? { destination, channel }
        : { email: destination };
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ErrorShape & { requestId?: string };
      if (!res.ok) {
        appendLog(`send error: ${data?.error?.code || res.status}`);
        if (res.status === 429) {
          const retry = res.headers.get("retry-after");
          setCooldownMsg(retry ? `Try again in ${retry}s` : "Rate limited");
        }
      } else {
        setRequestId(data.requestId || null);
        appendLog(`sent ok: ${data.requestId}`);
      }
    } catch (e) {
      appendLog("network error");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setLoading(true);
    try {
      const path = isOTP ? "/api/otp/verify" : "/api/ote/verify";
      const body = isOTP
        ? { destination, code }
        : { email: destination, code };
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ErrorShape;
      if (!res.ok) {
        appendLog(`verify error: ${data?.error?.code || res.status}`);
      } else {
        appendLog("verify ok");
      }
    } catch (e) {
      appendLog("network error");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setCooldownMsg(null);
    try {
      const path = isOTP ? "/api/otp/resend" : "/api/ote/resend";
      const body = isOTP
        ? { destination, channel }
        : { email: destination };
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ErrorShape;
      if (!res.ok) {
        appendLog(`resend error: ${data?.error?.code || res.status}`);
        if (res.status === 429) {
          const retry = res.headers.get("retry-after");
          setCooldownMsg(retry ? `Try again in ${retry}s` : "Cooldown active");
        }
      } else {
        appendLog("resend ok");
      }
    } catch (e) {
      appendLog("network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Playground</h1>
      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={isOTP}
            onChange={() => setIsOTP(true)}
          />
          OTP (sms/email)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={!isOTP}
            onChange={() => setIsOTP(false)}
          />
          OTE (email)
        </label>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          {isOTP ? "Destination (phone or email)" : "Email"}
        </label>
        <input
          className="w-full border rounded px-3 py-2"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder={isOTP ? "+15551234567 or user@example.com" : "user@example.com"}
        />
      </div>
      {isOTP && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Channel</label>
          <select
            className="border rounded px-3 py-2"
            value={channel}
            onChange={(e) => setChannel(e.target.value === "sms" ? "sms" : "email")}
          >
            <option value="sms">sms</option>
            <option value="email">email</option>
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <button
          disabled={loading || !destination}
          onClick={send}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          Send
        </button>
        <button
          disabled={loading || !destination}
          onClick={resend}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Resend
        </button>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Code</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
        />
        <button
          disabled={loading || !destination || !code}
          onClick={verify}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Verify
        </button>
      </div>
      {cooldownMsg && <p className="text-sm text-orange-600">{cooldownMsg}</p>}
      <div>
        <h2 className="font-semibold">Log</h2>
        <pre className="text-xs bg-gray-50 p-3 rounded max-h-64 overflow-auto">
{log.join("\n")}
        </pre>
      </div>
    </div>
  );
}


