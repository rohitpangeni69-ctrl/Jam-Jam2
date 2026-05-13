import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

export async function reconcileWallets() {
    console.log('[Reconciliation] Starting nightly wallet reconciliation...');
    let discrepanciesCount = 0;

    try {
        // Extract users who are drivers/riders with active wallets
        const usersSnapshot = await db.collection('users').get();

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const currentBalance = userData.walletBalance || 0;

            // Generate an immutable transaction history sum
            const transactionsSnapshot = await db.collection('wallet_transactions')
                .where('userId', '==', userId)
                .where('status', '==', 'completed')
                .get();

            let calculatedBalance = 0;
            transactionsSnapshot.forEach(txDoc => {
                const txData = txDoc.data();
                if (['credit', 'deposit', 'ride_earning', 'refund'].includes(txData.type)) {
                    calculatedBalance += txData.amount;
                } else if (['debit', 'withdrawal', 'commission', 'ride_payment'].includes(txData.type)) {
                    calculatedBalance -= txData.amount;
                }
            });

            // Prevent floating point anomalies
            currentBalance = parseFloat(currentBalance.toFixed(2));
            calculatedBalance = parseFloat(calculatedBalance.toFixed(2));

            // Detect drift
            if (Math.abs(calculatedBalance - currentBalance) > 0.05) {
                console.warn(`[Reconciliation] Anomaly for user ${userId}. DB: ${currentBalance}, Sum: ${calculatedBalance}`);
                
                await db.collection('reconciliation_alerts').add({
                    type: 'wallet_drift',
                    userId: userId,
                    dbBalance: currentBalance,
                    calculatedBalance: calculatedBalance,
                    difference: calculatedBalance - currentBalance,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'unresolved'
                });
                discrepanciesCount++;
            }
        }
        
        console.log(`[Reconciliation] Completed. Flagged ${discrepanciesCount} wallet anomalies.`);
    } catch (error) {
        console.error('[Reconciliation] Error during wallet reconciliation:', error);
    }
}
