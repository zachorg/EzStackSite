EzStack Console: Frontend for EzStack OTP/OTE and future modules.

Quickstart

1. Set environment variables (optional):

   - Firebase client config: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - Firebase Admin creds for local dev: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

2. Run the dev server:

```bash
npm run dev
```

3. In the app:

   - Sign in at `/login`, then go to `/account` to generate an API key. Keys are displayed once and not stored in plaintext.
   - Configure your project in `/settings`. OTP/OTE playground has been removed from the UI.

Implementation notes

- All browser requests go to Firebase HTTPS Functions at `/api/proxy/*` with `Authorization: Bearer <Firebase ID token>`.
- The proxy forwards to EzStack API over TLS and may inject `x-ezauth-key` or an ephemeral token; no CORS is required on the API.
- Rate-limit headers like `Retry-After` and `X-RateLimit-Reset` should be surfaced by the proxy for UX.

Adding a product tile

1. Edit `src/lib/products.ts` and add a new object to `productTiles`.
2. Provide: `slug`, `title`, `status`, `description`, `bullets`, `icon`, and links.
3. The `BentoGrid` reads this array and renders cards automatically; layout spans can be set via `span`.

Stripe (optional)

- Set `STRIPE_SECRET_KEY` and plan price IDs:
  - `PLAN_PRO_PRICE_ID`
  - `PLAN_SCALE_PRICE_ID`
- Go to `/plans` and select a paid plan to open Stripe Checkout.
