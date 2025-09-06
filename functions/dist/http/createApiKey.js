import { https, setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';
import { admin, firestore } from '../lib/common.js';
import { buildApiKey, getEnvName, hashApiKey, encryptWithKms, requireAuth } from '../lib/common.js';
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
        const doc = {
            userId: uid,
            keyPrefix: prefix,
            hashedKey: hashed,
            salt,
            alg: 'argon2id',
            params,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUsedAt: null,
            revokedAt: null,
            ...(typeof req.body?.name === 'string' && req.body.name.trim()
                ? { name: String(req.body.name).trim() }
                : {}),
            ...(Array.isArray(req.body?.scopes)
                ? { scopes: req.body.scopes.filter((s) => typeof s === 'string') }
                : {}),
        };
        const kmsKey = process.env.KMS_KEY_RESOURCE;
        const isDemo = req.body?.demo === true;
        if (isDemo && kmsKey) {
            const enc = await encryptWithKms(kmsKey, Buffer.from(plaintext));
            doc.keyMaterialEnc = enc.toString('base64');
        }
        const ref = await firestore.collection('apiKeys').add(doc);
        res.status(200).json({
            id: ref.id,
            key: plaintext,
            keyPrefix: prefix,
            name: doc.name || null,
            createdAt: null,
            lastUsedAt: null,
        });
    }
    catch (err) {
        const status = err instanceof HttpsError && err.code === 'unauthenticated' ? 401 : 500;
        res.status(status).json({ error: { message: err.message || 'Internal error' } });
    }
});
