import admin from 'firebase-admin';
import { https, setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import argon2 from 'argon2';

// Initialize Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const auth = admin.auth();

// Secret/KMS helpers
let cachedPepper: Buffer | null = null;
const kmsClient = new KeyManagementServiceClient();

async function getPepper(): Promise<Buffer> {
  if (cachedPepper) return cachedPepper;
  const pepper = process.env.APIKEY_PEPPER;
  if (!pepper) throw new Error('APIKEY_PEPPER not set');
  cachedPepper = Buffer.from(pepper);
  return cachedPepper;
}

// Optional: envelope encryption for demo key material
async function encryptWithKms(kmsKeyResource: string, plaintext: Buffer): Promise<Buffer> {
  const [res] = await kmsClient.encrypt({ name: kmsKeyResource, plaintext });
  if (!res.ciphertext) throw new Error('KMS encrypt returned empty ciphertext');
  return Buffer.from(res.ciphertext as Uint8Array);
}

async function decryptWithKms(kmsKeyResource: string, ciphertext: Buffer): Promise<Buffer> {
  const [res] = await kmsClient.decrypt({ name: kmsKeyResource, ciphertext });
  if (!res.plaintext) throw new Error('KMS decrypt returned empty plaintext');
  return Buffer.from(res.plaintext as Uint8Array);
}

// Utils
import { randomBytes, createHash } from 'node:crypto';

const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'I', 'l']);
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function generateBase32NoAmbiguous(length: number): string {
  const buf = randomBytes(length * 2);
  const chars: string[] = [];
  for (let i = 0; i < buf.length && chars.length < length; i++) {
    const ch = BASE32_ALPHABET[buf[i] % BASE32_ALPHABET.length];
    if (!AMBIGUOUS.has(ch)) chars.push(ch);
  }
  return chars.join('');
}

function computeChecksum(input: string): string {
  const h = createHash('sha256').update(input).digest();
  // Use 5 bytes -> 8 base32 chars
  const short = h.subarray(0, 5);
  // Convert to base32
  let out = '';
  for (let i = 0; i < short.length; i++) {
    out += BASE32_ALPHABET[short[i] % BASE32_ALPHABET.length];
  }
  return out;
}

function buildApiKey(envName: string): { plaintext: string; prefix: string } {
  const body = generateBase32NoAmbiguous(26);
  const core = `ezk_${envName}_${body}`;
  const checksum = computeChecksum(core);
  const plaintext = `${core}_${checksum}`;
  const prefix = plaintext.slice(0, 12);
  return { plaintext, prefix };
}

function getEnvName(): string {
  return process.env.FUNCTIONS_EMULATOR ? 'dev' : (process.env.RUNTIME_ENV || 'prod');
}

async function requireAuth(req: any): Promise<string> {
  const authz = req.headers.authorization || '';
  const token = authz.startsWith('Bearer ') ? authz.substring('Bearer '.length) : null;
  if (!token) throw new HttpsError('unauthenticated', 'Missing bearer token');
  const decoded = await auth.verifyIdToken(token, true);
  return decoded.uid;
}

type ApiKeyDoc = {
  userId: string;
  name?: string;
  keyPrefix: string;
  hashedKey: string;
  salt: string;
  alg: 'argon2id';
  params: { memoryCost: number; timeCost: number; parallelism: number };
  scopes?: string[];
  createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
  lastUsedAt: admin.firestore.FieldValue | admin.firestore.Timestamp | null;
  revokedAt: admin.firestore.FieldValue | admin.firestore.Timestamp | null;
  isDefault?: boolean;
  // Optional demo
  keyMaterialEnc?: string;
};

async function hashApiKey(plaintext: string): Promise<{ hashed: string; salt: string; params: ApiKeyDoc['params'] }> {
  const pepper = await getPepper();
  const { randomBytes } = require('node:crypto') as typeof import('node:crypto');
  const saltBuf = randomBytes(16);
  const salt = saltBuf.toString('base64');
  const params = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
  const hashed = await argon2.hash(Buffer.concat([pepper, Buffer.from(plaintext)]), {
    type: argon2.argon2id,
    memoryCost: params.memoryCost,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
    salt: saltBuf,
    hashLength: 32,
    raw: false,
  });
  return { hashed, salt, params };
}

setGlobalOptions({ maxInstances: 10 });

export const createApiKey = https.onRequest({
  timeoutSeconds: 30,
  cors: true,
  secrets: ['APIKEY_PEPPER'],
  region: process.env.FUNCTIONS_REGION || 'us-central1',
}, async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: { code: 'method_not_allowed' } });
        return;
      }
      const uid = await requireAuth(req);
      const envName = getEnvName();
      const { plaintext, prefix } = buildApiKey(envName);

      const { hashed, salt, params } = await hashApiKey(plaintext);

      const doc: ApiKeyDoc = {
        userId: uid,
        name: (req.body?.name as string) || undefined,
        keyPrefix: prefix,
        hashedKey: hashed,
        salt,
        alg: 'argon2id',
        params,
        scopes: Array.isArray(req.body?.scopes) ? (req.body.scopes as string[]) : undefined,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: null,
        revokedAt: null,
      };

      // Optional demo low-scope key blob
      const kmsKey = process.env.KMS_KEY_RESOURCE;
      const isDemo = req.body?.demo === true;
      if (isDemo && kmsKey) {
        const enc = await encryptWithKms(kmsKey, Buffer.from(plaintext));
        doc.keyMaterialEnc = enc.toString('base64');
      }

      const ref = await firestore.collection('apiKeys').add(doc);

      res.status(200).json({ id: ref.id, key: plaintext, keyPrefix: prefix });
    } catch (err: any) {
      const status = err instanceof HttpsError && err.code === 'unauthenticated' ? 401 : 500;
      res.status(status).json({ error: { message: err.message || 'Internal error' } });
    }
});

export const revokeApiKey = https.onRequest({ cors: true, region: process.env.FUNCTIONS_REGION || 'us-central1' }, async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: { code: 'method_not_allowed' } });
        return;
      }
      const uid = await requireAuth(req);
      const id = req.body?.id as string;
      if (!id) throw new HttpsError('invalid-argument', 'Missing id');
      const ref = firestore.collection('apiKeys').doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Key not found');
      const data = snap.data() as ApiKeyDoc;
      if (data.userId !== uid) throw new HttpsError('permission-denied', 'Forbidden');
      await ref.update({ revokedAt: admin.firestore.FieldValue.serverTimestamp(), isDefault: false });
      res.json({ ok: true });
    } catch (err: any) {
      const code = err.code === 'permission-denied' ? 403 : err.code === 'not-found' ? 404 : 500;
      res.status(code).json({ error: { message: err.message || 'Internal error' } });
    }
});

export const listApiKeys = https.onRequest({ cors: true, region: process.env.FUNCTIONS_REGION || 'us-central1' }, async (req, res) => {
    try {
      if (req.method !== 'GET') {
        res.status(405).json({ error: { code: 'method_not_allowed' } });
        return;
      }
      const uid = await requireAuth(req);
      const qs = await firestore
        .collection('apiKeys')
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      const items = qs.docs.map((d) => {
        const v = d.data() as ApiKeyDoc;
        return {
          id: d.id,
          userId: v.userId,
          name: v.name || null,
          keyPrefix: v.keyPrefix,
          alg: v.alg,
          params: v.params,
          scopes: v.scopes || [],
          createdAt: v.createdAt,
          lastUsedAt: v.lastUsedAt,
          revokedAt: v.revokedAt,
          isDefault: !!v.isDefault,
        };
      });
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || 'Internal error' } });
    }
});

export const setDefaultApiKey = https.onRequest({ cors: true, region: process.env.FUNCTIONS_REGION || 'us-central1' }, async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: { code: 'method_not_allowed' } });
        return;
      }
      const uid = await requireAuth(req);
      const id = req.body?.id as string;
      if (!id) throw new HttpsError('invalid-argument', 'Missing id');
      const ref = firestore.collection('apiKeys').doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError('not-found', 'Key not found');
      const data = snap.data() as ApiKeyDoc;
      if (data.userId !== uid) throw new HttpsError('permission-denied', 'Forbidden');
      const batch = firestore.batch();
      const qs = await firestore.collection('apiKeys').where('userId', '==', uid).get();
      qs.docs.forEach((d) => batch.update(d.ref, { isDefault: d.id === id }));
      await batch.commit();
      res.json({ ok: true });
    } catch (err: any) {
      const code = err.code === 'permission-denied' ? 403 : err.code === 'not-found' ? 404 : 500;
      res.status(code).json({ error: { message: err.message || 'Internal error' } });
    }
});

// Optional: demo proxy that decrypts demo key material server-side and forwards
export const demoProxyCall = https.onRequest({ cors: true, region: process.env.FUNCTIONS_REGION || 'us-central1' }, async (req, res) => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: { code: 'method_not_allowed' } });
        return;
      }
      const uid = await requireAuth(req);
      const id = req.body?.id as string;
      if (!id) throw new HttpsError('invalid-argument', 'Missing id');
      const kmsKey = process.env.KMS_KEY_RESOURCE;
      if (!kmsKey) throw new HttpsError('failed-precondition', 'KMS not configured');
      const snap = await firestore.collection('apiKeys').doc(id).get();
      if (!snap.exists) throw new HttpsError('not-found', 'Key not found');
      const data = snap.data() as ApiKeyDoc;
      if (data.userId !== uid) throw new HttpsError('permission-denied', 'Forbidden');
      if (!data.keyMaterialEnc) throw new HttpsError('failed-precondition', 'Not a demo key');
      const plaintext = await decryptWithKms(kmsKey, Buffer.from(data.keyMaterialEnc, 'base64'));
      // Perform a low-scope demo call here using plaintext, but never return it
      res.json({ ok: true, demo: true });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || 'Internal error' } });
    }
});


