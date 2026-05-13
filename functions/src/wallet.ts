import { https } from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize the Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

type TransactionType = 'topup' | 'ride_payment' | 'driver_commission' | 'withdrawal' | 'refund' | 'adjustment';
const MIN_DRIVER_BALANCE = 50; // Minimum Rs. 50 required to accept cash rides
const COMMISSION_RATE = 0.10; // 10%

export const createWalletIfMissing = https.onCall(async (data, context) => {
  if (!context.auth) throw new https.HttpsError('unauthenticated', 'User must be logged in');
  
  const uid = context.auth.uid;
  const walletRef = db.collection('wallets').doc(uid);
  
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(walletRef);
    if (!doc.exists) {
      transaction.set(walletRef, {
        balance: 0,
        currency: 'NPR',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { status: 'created', balance: 0 };
    }
    return { status: 'exists', balance: doc.data()?.balance };
  });
});

export const topUpWallet = https.onCall(async (data, context) => {
  // NOTE: This should ideally be called by a secure webhook (e.g., eSewa/Khalti) or an admin panel.
  // We provide a callable version here for prototyping/testing. In production, secure this!
  if (!context.auth) throw new https.HttpsError('unauthenticated', 'User must be logged in');
  
  const { amount, reference } = data;
  if (!amount || amount <= 0) throw new https.HttpsError('invalid-argument', 'Amount must be positive');
  
  const uid = context.auth.uid;
  const walletRef = db.collection('wallets').doc(uid);
  const txRef = walletRef.collection('transactions').doc(reference || db.collection('wallets').doc().id);

  return db.runTransaction(async (transaction) => {
    const txDoc = await transaction.get(txRef);
    if (txDoc.exists) throw new https.HttpsError('already-exists', 'Transaction reference already processed');

    const walletDoc = await transaction.get(walletRef);
    const currentBalance = walletDoc.exists ? walletDoc.data()?.balance || 0 : 0;

    if (!walletDoc.exists) {
       transaction.set(walletRef, {
         balance: amount,
         currency: 'NPR',
         updated_at: admin.firestore.FieldValue.serverTimestamp()
       });
    } else {
       transaction.update(walletRef, {
         balance: currentBalance + amount,
         updated_at: admin.firestore.FieldValue.serverTimestamp()
       });
    }

    transaction.set(txRef, {
      type: 'topup',
      amount: amount,
      status: 'completed',
      reference: reference || txRef.id,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { source: 'esewa_test' }
    });

    return { status: 'success', newBalance: currentBalance + amount };
  });
});

export const settleCompletedRide = https.onCall(async (data, context) => {
  if (!context.auth) throw new https.HttpsError('unauthenticated', 'User must be logged in');
  
  const { rideId, paymentMethod } = data;
  if (!rideId) throw new https.HttpsError('invalid-argument', 'Missing rideId');

  const rideRef = db.collection('active_rides').doc(rideId);

  return db.runTransaction(async (transaction) => {
    const rideDoc = await transaction.get(rideRef);
    if (!rideDoc.exists) throw new https.HttpsError('not-found', 'Ride not found');
    
    const ride = rideDoc.data()!;
    if (ride.status !== 'completed') throw new https.HttpsError('failed-precondition', 'Ride is not marked as completed');
    if (ride.payment_settled) throw new https.HttpsError('already-exists', 'Ride already settled');

    const driverId = ride.driver_id;
    const riderId = ride.rider_id;
    const fare = ride.estimated_fare;
    const commission = Math.round(fare * COMMISSION_RATE);

    const driverWalletRef = db.collection('wallets').doc(driverId);
    const riderWalletRef = db.collection('wallets').doc(riderId);

    const driverWalletDoc = await transaction.get(driverWalletRef);
    const driverBalance = driverWalletDoc.exists ? driverWalletDoc.data()?.balance || 0 : 0;

    if (paymentMethod === 'cash') {
      // Driver collects cash, but owes commission to the platform
      if (!driverWalletDoc.exists) throw new https.HttpsError('failed-precondition', 'Driver wallet not found');
      
      transaction.update(driverWalletRef, {
        balance: driverBalance - commission,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      const txRef = driverWalletRef.collection('transactions').doc(`comm_${rideId}`);
      transaction.set(txRef, {
        type: 'driver_commission',
        amount: -commission,
        status: 'completed',
        reference: rideId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        metadata: { rideId, fare, paymentMethod: 'cash' }
      });

    } else if (paymentMethod === 'wallet') {
      // Rider pays via wallet, driver gets (fare - commission)
      const riderWalletDoc = await transaction.get(riderWalletRef);
      const riderBalance = riderWalletDoc.exists ? riderWalletDoc.data()?.balance || 0 : 0;

      if (riderBalance < fare) throw new https.HttpsError('failed-precondition', 'Insufficient rider balance');
      
      // Deduct from Rider
      transaction.update(riderWalletRef, {
        balance: riderBalance - fare,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      const riderTxRef = riderWalletRef.collection('transactions').doc(`pay_${rideId}`);
      transaction.set(riderTxRef, {
         type: 'ride_payment',
         amount: -fare,
         status: 'completed',
         reference: rideId,
         created_at: admin.firestore.FieldValue.serverTimestamp(),
         metadata: { rideId, role: 'rider' }
      });

      // Credit securely into Driver
      const driverCredit = fare - commission;
      if (!driverWalletDoc.exists) {
        transaction.set(driverWalletRef, { balance: driverCredit, currency: 'NPR', updated_at: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        transaction.update(driverWalletRef, {
          balance: driverBalance + driverCredit,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      const driverTxRef = driverWalletRef.collection('transactions').doc(`earn_${rideId}`);
      transaction.set(driverTxRef, {
         type: 'ride_payment',
         amount: driverCredit, // net earning
         status: 'completed',
         reference: rideId,
         created_at: admin.firestore.FieldValue.serverTimestamp(),
         metadata: { rideId, fare, commission, role: 'driver' }
      });
    }

    // Mark ride as settled
    transaction.update(rideRef, { payment_settled: true });

    return { status: 'success', commission_deducted: commission };
  });
});
