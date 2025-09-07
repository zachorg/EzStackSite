import { https } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';
import { firestore, requireAuth } from '../lib/common.js';

export const revokeApiKey = https.onRequest({ cors: true, region: process.env.FUNCTIONS_REGION || 'us-central1' }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: { code: 'method_not_allowed' } });
      return;
    }
    const uid = await requireAuth(req);
    const id = req.body?.id as string;
    if (!id) throw new HttpsError('invalid-argument', 'Missing id');
    console.log(JSON.stringify({ event: 'revokeApiKey.request', uid, keyId: id }));
    const ref = firestore.collection('apiKeys').doc(id);
    // Use a transaction to verify ownership at delete time
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Key not found');
      const data = snap.data() as any;
      if (data.userId !== uid) throw new HttpsError('permission-denied', 'Forbidden');
      tx.delete(ref);
    });
    console.log(JSON.stringify({ event: 'revokeApiKey.deleted', uid, keyId: id }));
    res.json({ ok: true, deleted: true });
  } catch (err: any) {
    console.error(JSON.stringify({ event: 'revokeApiKey.error', message: err?.message || String(err) }));
    const code = err.code === 'permission-denied' ? 403 :  err.code === 'not-found' ? 404 : 500;
    res.status(code).json({ error: { message: err.message || 'Internal error' } });
  }
});