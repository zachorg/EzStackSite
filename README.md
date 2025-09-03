# EzStackSite

## API Key Management (Firebase)

- Cloud Functions (Node 20, TypeScript) in `functions/`:
  - `createApiKey`: issues API keys server-side, returns plaintext once
  - `listApiKeys`: returns metadata only
  - `revokeApiKey`: marks revokedAt
  - `setDefaultApiKey`: toggles default per-user
  - Optional: `demoProxyCall` uses KMS to decrypt demo key blobs server-side

### Security Properties
- Production keys are never stored in plaintext. Only Argon2id hashes with a pepper from Secret Manager are stored.
- Pepper is loaded at runtime from Secret Manager; it is not in `.env` or the client.
- Optional demo keys are stored only as KMS-encrypted blobs; plaintext never leaves server.
- Frontend shows the key once (Stripe-style), then only displays prefix/status/dates.

### Setup
1. Install firebase tools and login
   - `npm i -g firebase-tools`
   - `firebase login`
2. Initialize project (if not already)
   - Ensure `firebase.json` and `firestore.rules` exist
3. Create Secret Manager secret for pepper (Functions v2 secret)
   - In GCP: Secret Manager → Create secret named `APIKEY_PEPPER`
   - Value: a random 32+ byte string (e.g., Base64)
4. Configure Functions environment
   - Functions v2 will inject the secret as env `APIKEY_PEPPER` when declared in code
   - Optional: set `KMS_KEY_RESOURCE=projects/<PROJECT>/locations/<REGION>/keyRings/<KR>/cryptoKeys/<KEY>`
   - Optional: `RUNTIME_ENV=prod` and `FUNCTIONS_REGION=us-central1`
5. Deploy Firestore rules
   - `firebase deploy --only firestore:rules`
6. Build and deploy functions
   - `cd functions && npm run build`
   - `firebase deploy --only functions`

### Verify
- Ensure frontend env set in `frontend/.env.local`:
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION`, `NEXT_PUBLIC_FUNCTIONS_EMULATOR=false`
- Check the function URL works:
  - `curl -i https://<REGION>-<PROJECT>.cloudfunctions.net/createApiKey -H "Authorization: Bearer <ID_TOKEN>" -X POST -d '{}' -H 'content-type: application/json'`
  - Expect 200 with `{ id, key, keyPrefix }`

### Frontend
- Configure env in `frontend/.env.local` based on `frontend/env.example`:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION`
  - If using emulator: `NEXT_PUBLIC_FUNCTIONS_EMULATOR=true`
- The Next.js routes under `src/app/api/keys/*` and `src/app/api/key/generate` proxy to Cloud Functions.
- UI at `src/app/account/page.tsx` provides one-time reveal and key management.