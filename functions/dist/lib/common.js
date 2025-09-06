import admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
// Initialize Admin SDK once
if (!admin.apps.length) {
    admin.initializeApp();
}
export const firestore = admin.firestore();
export const auth = admin.auth();
// Secret/KMS helpers
let cachedPepper = null;
const kmsClient = new KeyManagementServiceClient();
export async function getPepper() {
    if (cachedPepper)
        return cachedPepper;
    const pepper = process.env.APIKEY_PEPPER;
    if (!pepper)
        throw new Error('APIKEY_PEPPER not set');
    cachedPepper = Buffer.from(pepper);
    return cachedPepper;
}
export async function encryptWithKms(kmsKeyResource, plaintext) {
    const [res] = await kmsClient.encrypt({ name: kmsKeyResource, plaintext });
    if (!res.ciphertext)
        throw new Error('KMS encrypt returned empty ciphertext');
    return Buffer.from(res.ciphertext);
}
export async function decryptWithKms(kmsKeyResource, ciphertext) {
    const [res] = await kmsClient.decrypt({ name: kmsKeyResource, ciphertext });
    if (!res.plaintext)
        throw new Error('KMS decrypt returned empty plaintext');
    return Buffer.from(res.plaintext);
}
// Utils
const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'I', 'l']);
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function generateBase32NoAmbiguous(length) {
    const buf = randomBytes(length * 2);
    const chars = [];
    for (let i = 0; i < buf.length && chars.length < length; i++) {
        const ch = BASE32_ALPHABET[buf[i] % BASE32_ALPHABET.length];
        if (!AMBIGUOUS.has(ch))
            chars.push(ch);
    }
    return chars.join('');
}
export function computeChecksum(input) {
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
export function buildApiKey(envName) {
    const body = generateBase32NoAmbiguous(26);
    const core = `ezk_${envName}_${body}`;
    const checksum = computeChecksum(core);
    const plaintext = `${core}_${checksum}`;
    const prefix = plaintext.slice(0, 12);
    return { plaintext, prefix };
}
export function getEnvName() {
    return process.env.FUNCTIONS_EMULATOR ? 'dev' : (process.env.RUNTIME_ENV || 'prod');
}
export async function requireAuth(req) {
    const headers = (req && req.headers) || {};
    const authz = (headers.authorization || headers.Authorization || '');
    const bearer = authz && typeof authz === 'string' && authz.startsWith('Bearer ')
        ? authz.substring('Bearer '.length)
        : '';
    if (bearer) {
        const decoded = await auth.verifyIdToken(bearer, true);
        return decoded.uid;
    }
    const rawCookie = (headers.cookie || headers.Cookie || '');
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
    throw new HttpsError('unauthenticated', 'Missing authentication');
}
export async function hashApiKey(plaintext) {
    const pepper = await getPepper();
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
export { admin, HttpsError };
