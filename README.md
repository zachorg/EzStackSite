# EzStackSite

## Authentication and API Keys (Supabase)

- Auth is provided by Supabase. Users can sign in with Google or email/password.
- The frontend does not store plaintext API keys; they are shown once on creation.
- Next.js route handlers under `frontend/src/app/api/keys/route.ts` proxy requests to the external EzStack API and forward the `Authorization` header (Supabase access token).

### Security Properties
- Plaintext keys are never persisted by the frontend. Only key prefixes and metadata are displayed.
- Authorization is via Supabase session cookies; the browser attaches them automatically.

### Setup
1. Create a Supabase project and obtain
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. In `frontend/.env.local`, set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Optional: `NEXT_PUBLIC_API_BASE_URL` for an external EzStack API base URL
3. Start the app:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

### Verify
- Visit `/login`, sign in, then go to `/api-keys` and create a key. The page will display the key once and show metadata in the table thereafter.

### Frontend
- Environment variables are documented in `frontend/env.example`.
- Auth helpers live in `frontend/src/lib/supabase/`.
- The proxy for API keys is at `frontend/src/app/api/keys/route.ts` and forwards to `NEXT_PUBLIC_API_BASE_URL` if set.