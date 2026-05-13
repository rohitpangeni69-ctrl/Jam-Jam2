import * as functions from 'firebase-functions';
import { cleanupStaleRides, cleanupRTDBData, archiveOldRides } from './cleanup';
import { reconcileWallets } from './reconciliation';
import { processRetryQueue } from './retryQueue';

// Run every 5 minutes to clean up stale rides and process backlogged retries
// Cost Optimization: Prevent stale listener wakeups and unbounded collection growth
export const everyFiveMinutes = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    console.log('[Automation] Running 5-minute cron job');
    try {
        await Promise.all([
            cleanupStaleRides(),
            processRetryQueue(),
            cleanupRTDBData()
        ]);
        console.log('[Automation] 5-minute cron job completed successfully');
    } catch (error) {
        console.error('[Automation] Error in 5-minute cron job:', error);
    }
});

// Run nightly at 2 AM Kathmandu Time for heavy lifting
export const nightlyReconciliation = functions.pubsub.schedule('0 2 * * *')
    .timeZone('Asia/Kathmandu')
    .onRun(async (context) => {
        console.log('[Automation] Running nightly reconciliation and archiving');
        try {
            await Promise.all([
                reconcileWallets(),
                archiveOldRides()
            ]);
            console.log('[Automation] Nightly job completed successfully');
        } catch (error) {
            console.error('[Automation] Error in nightly cron job:', error);
        }
    });
