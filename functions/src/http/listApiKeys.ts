import { https } from 'firebase-functions/v2';
import { firestore, requireAuth } from '../lib/common.js';

export const listApiKeys = https.onRequest({ cors: true, region: process.env.FUNCTIONS_REGION || 'us-central1' }, async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: { code: 'method_not_allowed' } });
      return;
    }
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
    res.status(500).json({ error: { message: err.message || 'Internal error' } });
  }
});


