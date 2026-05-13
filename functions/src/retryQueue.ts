import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

interface RetryTask {
    id: string;
    type: string;
    payload: any;
    retryCount: number;
    maxRetries: number;
    status: 'pending' | 'processing' | 'failed' | 'completed';
    nextRetryAt: number;
}

export async function processRetryQueue() {
    console.log('[RetryQueue] Processing retry queue...');
    const now = Date.now();
    
    try {
        const queueSnapshot = await db.collection('retry_queue')
            .where('status', '==', 'pending')
            .where('nextRetryAt', '<=', now)
            .orderBy('nextRetryAt', 'asc')
            .limit(100)
            .get();

        if (queueSnapshot.empty) return;

        for (const doc of queueSnapshot.docs) {
            const task = doc.data() as RetryTask;
            const ref = doc.ref;

            await ref.update({ status: 'processing' });

            try {
                // Execute Idempotent handlers
                await handleTask(task);
                
                await ref.update({ 
                    status: 'completed', 
                    completedAt: admin.firestore.FieldValue.serverTimestamp() 
                });
                console.log(`[RetryQueue] Task ${doc.id} (${task.type}) completed.`);
            } catch (error) {
                console.error(`[RetryQueue] Task ${doc.id} failed on retry ${task.retryCount + 1}:`, error);

                if (task.retryCount + 1 >= task.maxRetries) {
                    // Send off to Dead Letter Queue (DLQ)
                    await db.collection('dead_letter_queue').doc(doc.id).set({
                        ...task,
                        failedAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastError: error instanceof Error ? error.message : String(error)
                    });
                    await ref.update({ status: 'failed' });
                } else {
                    // Exponential backoff
                    const backoffMs = Math.pow(2, task.retryCount) * 60 * 1000; // 1m, 2m, 4m, 8m...
                    await ref.update({
                        retryCount: task.retryCount + 1,
                        nextRetryAt: now + backoffMs,
                        status: 'pending'
                    });
                }
            }
        }
    } catch (error) {
        console.error('[RetryQueue] Error orchestrating retry queue:', error);
    }
}

async function handleTask(task: RetryTask): Promise<void> {
    switch(task.type) {
        case 'wallet_settlement':
            // Idempotent wallet settlement
            console.log('[RetryQueue] Processing wallet settlement', task.payload);
            break;
        case 'send_notification':
            // Push Notification broadcast
            console.log('[RetryQueue] Processing notification fanout', task.payload);
            break;
        case 'external_webhook':
            // Retry calling external SMS/Payment gateways
            console.log('[RetryQueue] Processing webhook trigger', task.payload);
            break;
        default:
            throw new Error(`Unknown task type: ${task.type}`);
    }
}
