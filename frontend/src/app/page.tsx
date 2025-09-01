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
            href="/login"
            className="rounded-full border border-transparent bg-foreground text-background px-5 h-12 inline-flex items-center justify-center text-sm sm:text-base font-medium hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Sign in
          </Link>
          <Link
            href="/settings"
            className="rounded-full border border-black/[.08] dark:border-white/[.145] px-5 h-12 inline-flex items-center justify-center text-sm sm:text-base font-medium hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a]"
          >
            Open settings
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-black/[.08] dark:border-white/[.145] p-6">
          <h3 className="text-xl font-semibold mb-2">Google & Email sign-in</h3>
          <p className="text-foreground/80">
            Built-in auth flows for Google and email/password with secure server-side
            sessions using HTTP-only cookies.
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
        <h2 className="text-2xl font-semibold">Get started</h2>
        <ol className="list-decimal list-inside space-y-2 text-foreground/90">
          <li>
            Sign in at <span className="font-mono">/login</span> with Google or email.
          </li>
          <li>
            Configure your project in <span className="font-mono">/settings</span>.
          </li>
          <li>
            Add payments and protected routes as needed.
          </li>
        </ol>
        <div className="mt-4 text-sm text-foreground/70">
          Ready-made APIs and UI blocks speed up your launch. Explore the code in
          <span className="font-mono"> src/app</span> and <span className="font-mono"> src/lib</span>.
        </div>
      </section>
    </div>
  );
}
