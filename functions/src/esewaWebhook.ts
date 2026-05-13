import { https } from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Webhook endpoint for eSewa payment verifications.
 * In production, you would verify the signature/status with eSewa servers.
 */
export const esewaWebhook = https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const payload = req.body;
    const { transaction_uuid, status, total_amount, signature, user_id } = payload;
    
    // Store raw webhook payload for audit capability
    const auditRef = db.collection('payment_webhooks').doc();
    await auditRef.set({
      gateway: 'esewa',
      payload,
      received_at: admin.firestore.FieldValue.serverTimestamp(),
      verified: false
    });

    if (status !== 'COMPLETE') {
       res.status(400).send('Transaction not complete');
       return;
    }

    // TODO: Verify signature using eSewa Secret Key to prevent fraud!
    const isSignatureValid = true; // Mocked for demo
    if (!isSignatureValid) {
       res.status(401).send('Invalid Signature');
       return;
    }

    // Process top-up atomically
    if (user_id && total_amount && transaction_uuid) {
      const walletRef = db.collection('wallets').doc(user_id);
      const txRef = walletRef.collection('transactions').doc(transaction_uuid);
      
      await db.runTransaction(async (transaction) => {
         const txDoc = await transaction.get(txRef);
         if (txDoc.exists) {
            // Idempotent
            return;
         }

         const walletDoc = await transaction.get(walletRef);
         const currentBal = walletDoc.exists ? walletDoc.data()?.balance || 0 : 0;
         const amount = parseFloat(total_amount);

         if (!walletDoc.exists) {
            transaction.set(walletRef, {
               balance: amount,
               currency: 'NPR',
               updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
         } else {
            transaction.update(walletRef, {
               balance: currentBal + amount,
               updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
         }

         transaction.set(txRef, {
            type: 'topup',
            amount: amount,
            status: 'completed',
            reference: transaction_uuid,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            metadata: { gateway: 'esewa' }
         });
         
         // Mark audit as processed
         transaction.update(auditRef, { verified: true, processed_at: admin.firestore.FieldValue.serverTimestamp() });
      });
    }

    res.status(200).send({ success: true });
  } catch (error) {
    console.error("eSewa Webhook Error:", error);
    res.status(500).send('Internal Server Error');
  }
});
