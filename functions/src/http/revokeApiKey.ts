import { https } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';
import { firestore, requireAuth } from '../lib/common.js';

export const revokeApiKey = https.onRequest({ cors: true, region: process.env.FUNCTIONS_REGION || 'us-central1', minInstances: 1 }, async (req, res) => {
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
    const data = snap.data() as any;
    if (data.userId !== uid) throw new HttpsError('permission-denied', 'Forbidden');
    // Hard delete the document to fully remove key metadata from storage
    await ref.delete();
    res.json({ ok: true, deleted: true });
  } catch (err: any) {
    const code = err.code === 'permission-denied' ? 403 :  err.code === 'not-found' ? 404 : 500;
    res.status(code).json({ error: { message: err.message || 'Internal error' } });
  }
});