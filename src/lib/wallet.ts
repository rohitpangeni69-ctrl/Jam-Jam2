import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type TransactionType = 'topup' | 'ride_payment' | 'driver_commission' | 'withdrawal' | 'refund' | 'adjustment';

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  reference: string;
  created_at: string;
  metadata?: any;
}

export interface Wallet {
  balance: number;
  currency: string;
  updated_at: string;
}

/**
 * Subscribes to the live balance of the user.
 */
export function subscribeToWallet(userId: string, callback: (wallet: Wallet | null) => void) {
  if (!userId) return () => {};
  
  const walletRef = doc(db, 'wallets', userId);
  return onSnapshot(walletRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as Wallet);
    } else {
      callback(null);
    }
  });
}

/**
 * Subscribes to the transaction history of the user.
 */
export function subscribeToTransactions(userId: string, cb: (txns: WalletTransaction[]) => void) {
  if (!userId) return () => {};
  
  const txRef = collection(db, `wallets/${userId}/transactions`);
  const q = query(txRef, orderBy('created_at', 'desc'), limit(50));
  
  return onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WalletTransaction));
    cb(history);
  });
}

/**
 * MOCK TOP-UP FUNCTION FOR CLIENT PROTOTYPING
 * In production, the client should NEVER mutate balance directly.
 * Instead, they would call the Cloud Function `topUpWallet` or redirect to eSewa.
 */
export async function mockTopUpWallet(userId: string, amount: number) {
  const walletRef = doc(db, 'wallets', userId);
  const txId = 'mock_esewa_' + Date.now();
  const txRef = doc(db, `wallets/${userId}/transactions`, txId);

  await runTransaction(db, async (transaction) => {
    const walletDoc = await transaction.get(walletRef);
    const balance = walletDoc.exists() ? walletDoc.data()?.balance || 0 : 0;
    
    if (!walletDoc.exists()) {
      transaction.set(walletRef, {
         balance: amount,
         currency: 'NPR',
         updated_at: new Date().toISOString()
      });
    } else {
      transaction.update(walletRef, {
         balance: balance + amount,
         updated_at: new Date().toISOString()
      });
    }

    transaction.set(txRef, {
       type: 'topup',
       amount: amount,
       status: 'completed',
       reference: txId,
       created_at: new Date().toISOString(),
       metadata: { gateway: 'esewa_demo' }
    });
  });
}
