import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';

export const SecurityUtils = {
  async verifyAppCheck(context: any) {
    if (process.env.FUNCTIONS_EMULATOR === 'true') return true;
    if (!context.app) {
      logger.error('Callable function accessed without App Check token.');
      throw new HttpsError(
        'permission-denied', 
        'The function must be called from an App Check verified app.'
      );
    }
    return true;
  },
  
  async checkFraudFlags(userId: string) {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const data = userDoc.data();
    if (data?.fraud_flagged) {
      logger.warn(`User ${userId} with fraud flag attempted action.`);
      throw new HttpsError('permission-denied', 'Account suspended for suspicious activity.');
    }
    return true;
  }
};

export const detectAnomalies = async (rideData: any, userId: string) => {
  // Fraud detection logic: Impossible GPS jumps, rapid ride cancellation
  const db = admin.firestore();
  
  // Example: Check recent cancellations
  const recentSeconds = 300; // 5 minutes
  const recentThreshold = new Date(Date.now() - recentSeconds * 1000);
  
  const recentQuery = await db.collection('rides')
    .where('rider_id', '==', userId)
    .where('status', '==', 'cancelled')
    .where('created_at', '>=', recentThreshold.toISOString())
    .get();
    
  if (recentQuery.size > 3) {
    // Flag user
    await db.collection('users').doc(userId).update({ 
      fraud_flagged: true, 
      fraud_reason: 'excessive_cancellations',
      flagged_at: new Date().toISOString()
    });
    logger.warn(`User ${userId} flagged for successive rapidly cancelled rides.`);
    return { flagged: true, reason: 'excessive_cancellations' };
  }
  
  return { flagged: false };
}
