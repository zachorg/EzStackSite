import admin from 'firebase-admin';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';

// Initialize Admin SDK once. Prefer explicit service account on Render.
if (!admin.apps.length) {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const credential = admin.credential.cert(JSON.parse(saJson));
    admin.initializeApp({ credential });
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    });
    admin.initializeApp({ credential });
  } else {
    // Falls back to ADC if available (e.g., GOOGLE_APPLICATION_CREDENTIALS)
    admin.initializeApp();
  }
}

export const firestore = admin.firestore();
export const auth = admin.auth();

// Simple HTTP error for Express
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
let cachedPepper: Buffer | null = null;
const kmsClient = new KeyManagementServiceClient();

export async function getPepper(): Promise<Buffer> {
  if (cachedPepper) return cachedPepper;
  const pepper = process.env.APIKEY_PEPPER;
  if (!pepper) throw new HttpError(500, 'APIKEY_PEPPER not set');
  cachedPepper = Buffer.from(pepper);
  return cachedPepper;
}

export async function encryptWithKms(kmsKeyResource: string, plaintext: Buffer): Promise<Buffer> {
  const [res] = await kmsClient.encrypt({ name: kmsKeyResource, plaintext });
  if (!res.ciphertext) throw new HttpError(500, 'KMS encrypt returned empty ciphertext');
  return Buffer.from(res.ciphertext as Uint8Array);
}

export async function decryptWithKms(kmsKeyResource: string, ciphertext: Buffer): Promise<Buffer> {
  const [res] = await kmsClient.decrypt({ name: kmsKeyResource, ciphertext });
  if (!res.plaintext) throw new HttpError(500, 'KMS decrypt returned empty plaintext');
  return Buffer.from(res.plaintext as Uint8Array);
}

// Utils
const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'I', 'l']);
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32NoAmbiguous(length: number): string {
  const buf = randomBytes(length * 2);
  const chars: string[] = [];
  for (let i = 0; i < buf.length && chars.length < length; i++) {
    const ch = BASE32_ALPHABET[buf[i] % BASE32_ALPHABET.length];
    if (!AMBIGUOUS.has(ch)) chars.push(ch);
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

export async function requireAuth(req: any): Promise<string> {
  const headers = (req && req.headers) || {};
  const authz: string = (headers.authorization || headers.Authorization || '') as string;
  const bearer = authz && typeof authz === 'string' && authz.startsWith('Bearer ')
    ? authz.substring('Bearer '.length)
    : '';
  if (bearer) {
    const decoded = await auth.verifyIdToken(bearer, true);
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
  const params = isProd
    ? { memoryCost: 19456, timeCost: 2, parallelism: 1 }
    : { memoryCost: 1024, timeCost: 1, parallelism: 1 };
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


