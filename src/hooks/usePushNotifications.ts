import { useEffect, useState } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/notifications';
import { auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { nativePush } from '@/lib/native/notifications';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc } from 'firebase/firestore';

export interface DispatchPayload {
  rideId: string;
  pickup_address: string;
  dropoff_address: string;
  estimated_fare: string;
  distance_km: string;
  vehicle_id: string;
  timeout_ms: string;
  created_at: string;
}

export function usePushNotifications(isDriver: boolean = false) {
  const [incomingRide, setIncomingRide] = useState<DispatchPayload | null>(null);

  useEffect(() => {
    // 1. Request FCM permission securely if logged in
    const initPush = async () => {
      if (!isDriver || !auth.currentUser) return;

      if (Capacitor.isNativePlatform()) {
        await nativePush.createChannel();
        await nativePush.initialize(
          // onToken
          async (token) => {
            if (auth.currentUser) {
              await setDoc(doc(db, 'fcm_tokens', auth.currentUser.uid), {
                token: token,
                platform: 'android',
                updatedAt: new Date().toISOString()
              }, { merge: true });
            }
          },
          // onPushReceived (foreground)
          (notification) => {
            const data = notification.data;
            if (data && data.type === 'new_ride_dispatch') {
               const dispatchData = data as unknown as DispatchPayload;
               const createdMs = new Date(dispatchData.created_at).getTime();
               const timeoutMs = parseInt(dispatchData.timeout_ms || '30000');
               if (Date.now() - createdMs < timeoutMs) {
                 setIncomingRide(dispatchData);
               }
            }
          },
          // onPushAction (tapped notification)
          (action) => {
             const data = action.notification.data;
             if (data && data.type === 'new_ride_dispatch') {
               const dispatchData = data as unknown as DispatchPayload;
               setIncomingRide(dispatchData);
             }
          }
        );
      } else {
        await requestNotificationPermission();
      }
    };
    initPush();

    // 2. Listen for REAL web pushes (Foreground fallback for web)
    const unsubscribeFCM = onForegroundMessage((payload) => {
      if (payload.data && payload.data.type === 'new_ride_dispatch') {
        const dispatchData = payload.data as unknown as DispatchPayload;
        
        // TTL Check to avoid stale notifications popping up
        const createdMs = new Date(dispatchData.created_at).getTime();
        const timeoutMs = parseInt(dispatchData.timeout_ms || '30000');
        if (Date.now() - createdMs < timeoutMs) {
          setIncomingRide(dispatchData);
        }
      }
    });

    return () => {
      unsubscribeFCM();
    };
  }, []);

  // 3. Fallback: Firestore realtime listener for active 'requested' rides
  // Because web push reliability in browser previews varies, 
  // this guarantees the driver sees new requests if the app is open.
  useEffect(() => {
    if (!isDriver || !auth.currentUser) return;

    // Listen to new requests. (In production, the Cloud Function does the geo-filtering)
    const q = query(
      collection(db, 'active_rides'),
      where('status', '==', 'requested'),
      where('driver_id', '==', null)
    );

    const unsubscribeDB = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          
          // Formulate mock payload from database struct
          const mockPayload: DispatchPayload = {
            rideId: change.doc.id,
            pickup_address: data.pickup.address,
            dropoff_address: data.dropoff.address,
            estimated_fare: data.estimated_fare,
            distance_km: data.distance_km,
            vehicle_id: data.vehicle_id,
            timeout_ms: '30000',
            created_at: data.created_at
          };

          const createdMs = new Date(data.created_at).getTime();
          if (Date.now() - createdMs < 30000) {
            setIncomingRide(mockPayload);
          }
        }
      });
    });

    return () => {
      unsubscribeDB();
    };
  }, []);

  const clearIncomingRide = () => setIncomingRide(null);

  return { incomingRide, clearIncomingRide };
}
