// Entry point for the Render-hosted (or local) API server.
// Exposes endpoints to create/list/revoke API keys backed by Firestore.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { admin, firestore, requireAuth, buildApiKey, getEnvName, hashApiKey, encryptWithKms, HttpError } from './common';

// Minimal Express server hosting API key endpoints
const app = express();
const port = Number(process.env.PORT || 4000);
const corsOrigin = (process.env.CORS_ORIGIN as string | undefined) || true;

app.use(cors({ origin: corsOrigin as any, credentials: true }));
app.use(express.json());

// Liveness probe
app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Create a new API key for the authenticated user.
// Steps: verify auth -> generate key -> argon2 hash -> optional KMS demo encrypt -> store in Firestore
app.post('/createApiKey', async (req, res) => {
  try {
    const uid = await requireAuth(req);
    console.log(JSON.stringify({ event: 'createApiKey.request', uid }));
    const envName = getEnvName();
    const { plaintext, prefix } = buildApiKey(envName);

    const { hashed, salt, params } = await hashApiKey(plaintext);

    // Validate optional inputs
    const rawName = typeof req.body?.name === 'string' ? String(req.body.name).trim() : '';
    const name = rawName ? rawName.slice(0, 120) : undefined;
    const rawScopes = Array.isArray(req.body?.scopes) ? (req.body.scopes as unknown[]) : [];
    const scopes = rawScopes
      .filter((s) => typeof s === 'string')
      .map((s) => (s as string).trim())
      .filter((s) => s.length)
      .slice(0, 20);

    // Persist only hashed key materials; plaintext is returned once and not stored
    const doc: any = {
      userId: uid,
      keyPrefix: prefix,
      hashedKey: hashed,
      salt,
      alg: 'argon2id',
      params,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsedAt: null,
      revokedAt: null,
      ...(name ? { name } : {}),
      ...(scopes.length ? { scopes } : {}),
    };

    const kmsKey = process.env.KMS_KEY_RESOURCE;
    const demoEnabled = process.env.DEMO_ENCRYPT_ENABLED === 'true';
    const isDemo = req.body?.demo === true;
    // Optional demo: store KMS-encrypted plaintext to allow later reveal in controlled demos
    if (demoEnabled && isDemo && kmsKey) {
      const enc = await encryptWithKms(kmsKey, Buffer.from(plaintext));
      (doc as any).keyMaterialEnc = enc.toString('base64');
    }

    const ref = await firestore.collection('apiKeys').add(doc);
    console.log(JSON.stringify({ event: 'createApiKey.document_created', uid, keyId: ref.id, keyPrefix: prefix }));
    res.status(200).json({
      id: ref.id,
      key: plaintext,
      keyPrefix: prefix,
      name: (doc as any).name || null,
      createdAt: null,
      lastUsedAt: null,
    });
  } catch (err: any) {
    console.error(JSON.stringify({ event: 'createApiKey.error', message: err?.message || String(err) }));
    const status = err instanceof HttpError && err.status ? err.status : 500;
    res.status(status).json({ error: { message: err.message || 'Internal error' } });
  }
});

// List API keys for the authenticated user (limited to 100), newest first
app.get('/listApiKeys', async (req, res) => {
  try {
    const uid = await requireAuth(req);
    console.log(JSON.stringify({ event: 'listApiKeys.request', uid }));
    const qs = await firestore
      .collection('apiKeys')
      .where('userId', '==', uid)
      .limit(100)
      .get();
    const items = qs.docs.map((d) => {
      const v: any = d.data();
      return {
        id: d.id,
        name: v.name || null,
        keyPrefix: v.keyPrefix,
        createdAt: v.createdAt,
        lastUsedAt: v.lastUsedAt,
        revokedAt: v.revokedAt,
      };
    }).sort((a, b) => {
      const ad = (a.createdAt && (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt.seconds * 1000))) || new Date(0);
      const bd = (b.createdAt && (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt.seconds * 1000))) || new Date(0);
      return bd.getTime() - ad.getTime();
    });
    res.json({ items });
  } catch (err: any) {
    console.error(JSON.stringify({ event: 'listApiKeys.error', message: err?.message || String(err) }));
    const status = err instanceof HttpError && err.status ? err.status : 500;
    res.status(status).json({ error: { message: err.message || 'Internal error' } });
  }
});

// Revoke (delete) an API key by id for the authenticated user.
// Optimized path: simple get + ownership check + delete to reduce latency vs transactions
app.post('/revokeApiKey', async (req, res) => {
  try {
    const uid = await requireAuth(req);
    const id = req.body?.id as string;
    if (!id) {
      throw new HttpError(400, 'Missing id', 'invalid-argument');
    }
    console.log(JSON.stringify({ event: 'revokeApiKey.request', uid, keyId: id }));
    const ref = firestore.collection('apiKeys').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpError(404, 'Key not found', 'not-found');
    }
    const data = snap.data() as any;
    if (data.userId !== uid) throw new HttpError(403, 'Forbidden', 'permission-denied');
    await ref.delete();
    console.log(JSON.stringify({ event: 'revokeApiKey.deleted', uid, keyId: id }));
    res.json({ ok: true, deleted: true });
  } catch (err: any) {
    console.error(JSON.stringify({ event: 'revokeApiKey.error', message: err?.message || String(err) }));
    const status = err instanceof HttpError && err.status ? err.status : 500;
    res.status(status).json({ error: { message: err.message || 'Internal error' } });
  }
});

app.listen(port, () => {
  console.log(`api listening on :${port}`);
});


