"use client";

import { useEffect, useRef, useState } from "react";

type SessionStatus = { loggedIn: boolean; uid?: string };

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SessionStatus>({ loggedIn: false });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/session/status", { cache: "no-store" });
        const data = (await res.json()) as SessionStatus;
        setStatus(data);
      } catch {}
    }
    fetchStatus();
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function signOut() {
    try {
      await fetch("/api/session/end", { method: "POST" });
      window.location.href = "/";
    } catch {}
  }

  if (!status.loggedIn) {
    return (
      <a
        href="/login"
        className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
      >
        Sign in / Create account
      </a>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm px-3 py-1.5 border rounded"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Profile
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 rounded border bg-background shadow"
        >
          <a
            href="/account"
            className="block px-4 py-2 text-sm hover:bg-gray-50"
            role="menuitem"
          >
            Account settings
          </a>
          <button
            onClick={signOut}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            role="menuitem"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}


