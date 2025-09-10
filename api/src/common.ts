// Common primitives for API key generation/verification and Firebase Admin wiring.
// This module centralizes:
// - Firebase Admin initialization (project/credential resolution)
// - Firestore/Auth handles
// - Security helpers (pepper management, KMS wrappers)
// - Key generation and hashing utilities
import admin from 'firebase-admin';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';

// Initialize Firebase Admin SDK once. Prefer explicit service account on Render.
// Credential resolution strategy, in order:
// 1) FIREBASE_SERVICE_ACCOUNT_JSON (full JSON blob)
// 2) Split FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (with \n handling)
// 3) GOOGLE_APPLICATION_CREDENTIALS (ADC), but pass projectId explicitly to avoid GCP metadata lookup
if (!admin.apps.length) {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (saJson) {
    const parsed = JSON.parse(saJson);
    const credential = admin.credential.cert(parsed);
    admin.initializeApp({ credential, projectId: parsed.project_id || projectId });
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    });
    admin.initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID });
  } else if (projectId) {
    // Falls back to ADC if available (e.g., GOOGLE_APPLICATION_CREDENTIALS), but pass projectId explicitly
    admin.initializeApp({ projectId });
  } else {
    throw new Error('Missing Firebase project configuration. Set FIREBASE_PROJECT_ID and service account credentials.');
  }
}

export const firestore = admin.firestore();
export const auth = admin.auth();

// Lightweight HTTP error for Express handlers that need custom status codes
export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Secret/KMS helpers
// Security note: APIKEY_PEPPER must be kept secret server-side and NEVER exposed to clients.
// It is concatenated with the plaintext key prior to hashing, so even if the DB is leaked,
// offline cracking requires both per-key salts and the server-only pepper.
// APIKEY_PEPPER is cached to avoid repeated reads.
let cachedPepper: Buffer | null = null;
const kmsClient = new KeyManagementServiceClient();

export async function getPepper(): Promise<Buffer> {
  if (cachedPepper) {
    return cachedPepper;
  }
  const pepper = process.env.APIKEY_PEPPER;
  if (!pepper) {
    throw new HttpError(500, 'APIKEY_PEPPER not set');
  }
  cachedPepper = Buffer.from(pepper);
  return cachedPepper;
}

export async function encryptWithKms(kmsKeyResource: string, plaintext: Buffer): Promise<Buffer> {
  const [res] = await kmsClient.encrypt({ name: kmsKeyResource, plaintext });
  if (!res.ciphertext) throw new HttpError(500, 'KMS encrypt returned empty ciphertext');
  return Buffer.from(res.ciphertext as Uint8Array);
}

// Utils
// Base32 helpers avoid ambiguous characters (e.g., 0/O, 1/l/I) to reduce human transcription errors.
const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'I', 'l']);
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32NoAmbiguous(length: number): string {
  const buf = randomBytes(length * 2);
  const chars: string[] = [];
  for (let i = 0; i < buf.length && chars.length < length; i++) {
    const ch = BASE32_ALPHABET[buf[i] % BASE32_ALPHABET.length];
    if (!AMBIGUOUS.has(ch)) {
      chars.push(ch);
    }
  }
  return chars.join('');
}

export function computeChecksum(input: string): string {
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

// Keys look like: ezk_<env>_<random>_<checksum>
// - <env>: from RUNTIME_ENV (e.g., dev, prod)
// - <random>: 26 base32 chars without ambiguous characters
// - <checksum>: 8 base32 chars derived from sha256(core) to help detect typos
// `prefix` is the first 12 chars for safer logs and UI display; the full plaintext is returned once only.
export function buildApiKey(envName: string): { plaintext: string; prefix: string } {
  const body = generateBase32NoAmbiguous(26);
  const core = `ezk_${envName}_${body}`;
  const checksum = computeChecksum(core);
  const plaintext = `${core}_${checksum}`;
  const prefix = plaintext.slice(0, 12);
  return { plaintext, prefix };
}

export function getEnvName(): string {
  return process.env.RUNTIME_ENV || 'prod';
}

// Verify Firebase auth using either Authorization: Bearer <ID_TOKEN> or __session cookie.
// Performance note: verifyIdToken(bearer, true) adds revocation checks and can cost an extra network call.
// If you do not require immediate token revocation, calling verifyIdToken(bearer) is faster.
export async function requireAuth(req: any): Promise<string> {
  const headers = (req && req.headers) || {};
  const authz: string = (headers.authorization || headers.Authorization || '') as string;
  const bearer = authz
    && typeof authz === 'string'
    && authz.startsWith('Bearer ')
    ? authz.substring('Bearer '.length)
    : '';
  if (bearer) {
    const decoded = await auth.verifyIdToken(bearer);
    return decoded.uid;
  }
  const rawCookie: string = (headers.cookie || headers.Cookie || '') as string;
  if (rawCookie) {
    const parts = rawCookie.split(';');
    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k && k.trim() === '__session' && typeof v === 'string') {
        const decoded = await auth.verifySessionCookie(decodeURIComponent(v), true);
        return decoded.uid;
      }
    }
  }
  throw new HttpError(401, 'Missing authentication', 'unauthenticated');
}

export type ApiKeyDoc = {
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
  // Optional demo
  keyMaterialEnc?: string;
};

export async function hashApiKey(plaintext: string): Promise<{ hashed: string; salt: string; params: ApiKeyDoc['params'] }> {
  const pepper = await getPepper();
  const saltBuf = randomBytes(16);
  const salt = saltBuf.toString('base64');
  const envName = getEnvName();
  const isProd = envName === 'prod';
  // Ensure timeCost >= 2 to satisfy argon2 constraints
  const params = isProd
    ? { memoryCost: 19456, timeCost: 2, parallelism: 1 }
    : { memoryCost: 1024, timeCost: 2, parallelism: 1 };
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

export { admin };


