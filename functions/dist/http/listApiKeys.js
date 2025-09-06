import { https } from 'firebase-functions/v2';
import { firestore, requireAuth } from '../lib/common.js';
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
            const v = d.data();
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
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message || 'Internal error' } });
    }
});
