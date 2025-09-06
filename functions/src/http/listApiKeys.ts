import { https } from 'firebase-functions/v2';
import { firestore, requireAuth } from '../lib/common.js';

export const listApiKeys = https.onRequest({ cors: true, region: process.env.FUNCTIONS_REGION || 'us-central1', minInstances: 1 }, async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: { code: 'method_not_allowed' } });
      return;
    }
    const uid = await requireAuth(req);
    const qs = await firestore
      .collection('apiKeys')
      .where('userId', '==', uid)
      .limit(100)
      .get();
    const items = qs.docs.map((d) => {
      const v: any = d.data();
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
    }).sort((a, b) => {
      const ad = (a.createdAt && (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt.seconds * 1000))) || new Date(0);
      const bd = (b.createdAt && (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt.seconds * 1000))) || new Date(0);
      return bd.getTime() - ad.getTime();
    });
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'Internal error' } });
  }
});


