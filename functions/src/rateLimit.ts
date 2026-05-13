import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

export async function checkRateLimit(userId: string, action: string, windowMs: number, maxRequests: number): Promise<boolean> {
  const db = admin.firestore();
  const now = Date.now();
  const windowStart = now - windowMs;

  const key = `rate_limit_${userId}_${action}`;
  const ref = db.collection('rate_limits').doc(key);

  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      let requests: number[] = [];

      if (doc.exists) {
        requests = doc.data()?.requests || [];
      }

      // Filter out old requests
      requests = requests.filter(time => time > windowStart);

      if (requests.length >= maxRequests) {
        logger.warn(`Rate limit exceeded for user ${userId} on action ${action}`);
        return false; // Rate limit exceeded
      }

      requests.push(now);
      transaction.set(ref, { requests, updatedAt: new Date().toISOString() });
      
      return true;
    });
  } catch (error) {
    logger.error('Rate limit transaction failed', error);
    // Open fail-safe, or assume limited based on severity. Returning false to be secure.
    return false;
  }
}
