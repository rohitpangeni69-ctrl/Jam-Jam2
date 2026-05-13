import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const rtdb = admin.database();

// Time limit threshold for stale states
const STALE_PENDING_MS = 15 * 60 * 1000;   // 15 minutes for pending/searching
const STALE_ACCEPTED_MS = 60 * 60 * 1000;  // 60 minutes for accepted/arrived (stalled dispatch)

export async function cleanupStaleRides() {
    const now = Date.now();
    const batch = db.batch();
    let count = 0;

    try {
        // 1. Cleanup stale pending rides (abandoned requests, ghost bidding)
        const pendingSnapshot = await db.collection('rides')
            .where('status', 'in', ['pending', 'searching', 'bidding'])
            .where('timestamp', '<', now - STALE_PENDING_MS)
            .get();

        pendingSnapshot.forEach(doc => {
            batch.update(doc.ref, { 
                status: 'expired',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                cancelReason: 'system_timeout_pending'
            });
            count++;
        });

        // 2. Cleanup stale accepted rides (driver didn't move, app crashed, aborted)
        const acceptedSnapshot = await db.collection('rides')
            .where('status', 'in', ['accepted', 'arrived'])
            .get(); // Note: Without a composite index, we might need a simpler query or post-filtering

        acceptedSnapshot.forEach(doc => {
            const data = doc.data();
            const lastUpdated = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.timestamp;
            if (lastUpdated && lastUpdated < (now - STALE_ACCEPTED_MS)) {
                batch.update(doc.ref, { 
                    status: 'expired',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    cancelReason: 'system_timeout_stalled'
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`[Cleanup] Cleaned up ${count} stale rides.`);
        }
    } catch (error) {
        console.error('[Cleanup] Error cleaning up stale rides:', error);
    }
}

export async function cleanupRTDBData() {
    const now = Date.now();
    const STALE_LOCATION_MS = 2 * 60 * 60 * 1000; // 2 hours

    try {
        // Find disconnected tracking sessions
        const locationsRef = rtdb.ref('drivers_locations');
        const snapshot = await locationsRef.orderByChild('timestamp').endAt(now - STALE_LOCATION_MS).once('value');
        
        const updates: Record<string, null> = {};
        snapshot.forEach((child) => {
            if (child.key) {
                updates[child.key] = null;
            }
        });

        const keysCount = Object.keys(updates).length;
        if (keysCount > 0) {
            await locationsRef.update(updates);
            console.log(`[Cleanup] Purged ${keysCount} stale driver location nodes (RTDB spam).`);
        }
    } catch (error) {
        console.error('[Cleanup] Error cleaning up RTDB data:', error);
    }
}

export async function archiveOldRides() {
    const now = Date.now();
    const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days hot retention
    
    try {
        const ridesRef = db.collection('rides');
        const archiveRef = db.collection('archived_rides');
        
        // Prevent unbounded collection growth
        const snapshot = await ridesRef
            .where('status', 'in', ['completed', 'cancelled', 'expired'])
            .where('timestamp', '<', now - RETENTION_MS)
            .limit(500)
            .get();

        if (snapshot.empty) return;

        const batch = db.batch();
        let archiveCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            batch.set(archiveRef.doc(doc.id), data);
            batch.delete(doc.ref);
            archiveCount++;
        });

        await batch.commit();
        console.log(`[Archive] Moved ${archiveCount} old rides to archived_rides.`);
    } catch (error) {
        console.error('[Archive] Error archiving old rides:', error);
    }
}
