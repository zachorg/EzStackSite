export default function DocsPage() {
  return (
    <div className="prose max-w-3xl">
      <h1>EzStack Docs</h1>
      <p>
        Welcome to EzStack. Below are essential steps to get started.
      </p>
      <h2>Authentication</h2>
      <ol>
        <li>Sign in with Google from the top-right.</li>
        <li>Go to Account to generate your API key. Keys are shown once and not stored in plaintext.</li>
      </ol>
      <h2>API Key</h2>
      <p>
        Browser calls go through Firebase HTTPS Functions at <code>/api/proxy/*</code> with your Firebase ID token.
        The proxy injects credentials to the EzStack API; no plaintext keys are stored client-side.
      </p>
      <h2>Next steps</h2>
      <ul>
        <li>Integrate OTP/OTE flows in your app’s backend using EzStack.</li>
        <li>Use Stripe or another provider for billing as needed.</li>
      </ul>
    </div>
  );
}


