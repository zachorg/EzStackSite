import Link from "next/link";

export default function Home() {
  return (
    <div className="font-sans space-y-16">
      <section className="text-center sm:text-left space-y-6">
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight">
          App Functionality made easy
        </h1>
        <p className="text-lg text-foreground/80 max-w-2xl mx-auto sm:mx-0">
          EzStack gives you production-ready building blocks for modern apps:
          authentication with OTP/OTE, payments, configuration, and a clean
          console—all wired for Next.js and TypeScript.
        </p>
        <div className="flex gap-3 justify-center sm:justify-start">
          <Link
            href="/playground"
            className="rounded-full border border-transparent bg-foreground text-background px-5 h-12 inline-flex items-center justify-center text-sm sm:text-base font-medium hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Try the Playground
          </Link>
          <Link
            href="/settings"
            className="rounded-full border border-black/[.08] dark:border-white/[.145] px-5 h-12 inline-flex items-center justify-center text-sm sm:text-base font-medium hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]"
          >
            Configure Settings
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-6">
          <h3 className="text-xl font-semibold mb-2">OTP & OTE out of the box</h3>
          <p className="text-foreground/80">
            Production-grade email/SMS one-time codes with resend and verify endpoints
            ready to call. From the browser, call <code className="font-mono">/api/proxy/otp</code> or
            <code className="font-mono">/api/proxy/ote</code>.
          </p>
        </div>
        <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-6">
          <h3 className="text-xl font-semibold mb-2">Subscriptions made simple</h3>
          <p className="text-foreground/80">
            Built-in Stripe Checkout flows with success and cancel pages so you can
            launch paid plans fast.
          </p>
        </div>
        <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-6">
          <h3 className="text-xl font-semibold mb-2">Secure by default</h3>
          <p className="text-foreground/80">
            Server-first design, cookie utilities, and minimal attack surface. Ship
            confidently without reinventing auth and session plumbing.
          </p>
        </div>
        <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-6">
          <h3 className="text-xl font-semibold mb-2">TypeScript native</h3>
          <p className="text-foreground/80">
            Strong types from API to UI, built for the Next.js App Router so you get
            fast DX and safer refactors.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="list-decimal list-inside space-y-2 text-foreground/90">
          <li>
            Configure your API keys and settings in the console at
            <span className="font-mono"> /settings</span>.
          </li>
          <li>
            Trigger OTP or OTE from your app using the built-in API routes.
          </li>
          <li>
            Verify the code and complete sign-in or sensitive actions.
          </li>
        </ol>
        <div className="mt-4">
          <pre className="bg-black/[.05] dark:bg-white/[.06] rounded-lg p-4 overflow-x-auto text-xs">
            <code className="font-mono">
{`// Send a one-time code via Firebase Function proxy
await fetch('/api/proxy/otp/send', {
  method: 'POST',
  body: JSON.stringify({ to: email }),
  headers: { 'Content-Type': 'application/json' },
});

// Verify the code via Firebase Function proxy
const res = await fetch('/api/proxy/otp/verify', {
  method: 'POST',
  body: JSON.stringify({ to: email, code }),
  headers: { 'Content-Type': 'application/json' },
});
if (!res.ok) throw new Error('Invalid code');`}
            </code>
          </pre>
        </div>
      </section>
    </div>
  );
}
