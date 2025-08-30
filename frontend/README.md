EzStack Console: Frontend for EzAuth OTP/OTE and future modules.

Quickstart

1. Set environment variables (optional):

   - `EZAUTH_BASE_URL` (default `http://localhost:8080`)

2. Run the dev server:

```bash
npm run dev
```

3. In the app:

   - Go to `/settings` and paste your `x-ezauth-key`. It is stored as an HttpOnly cookie.
   - Use `/playground` to send/verify/resend OTP (sms/email) or OTE (email) codes.

Implementation notes

- Requests are proxied via Next.js API routes and attach `x-ezauth-key` from the cookie.
- Rate-limit headers like `Retry-After` and `X-RateLimit-Reset` are forwarded for UX.
- Protected routes (playground, dashboard) require the API key cookie and redirect to `/settings` if missing.

Stripe (optional)

- Set `STRIPE_SECRET_KEY` and plan price IDs:
  - `PLAN_PRO_PRICE_ID`
  - `PLAN_SCALE_PRICE_ID`
- Go to `/plans` and select a paid plan to open Stripe Checkout.
