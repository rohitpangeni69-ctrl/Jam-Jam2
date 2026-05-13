import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { offlineQueue } from '@/lib/offlineQueue';
import { useNetworkStatus } from './useNetworkStatus';

export function useRideRecovery(role: 'driver' | 'rider') {
  const { isOnline } = useNetworkStatus();
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState<boolean>(true);

  useEffect(() => {
    const recoverRides = async () => {
      if (!isOnline || !auth.currentUser) return;
      
      setIsRecovering(true);
      try {
        const ridesRef = collection(db, 'active_rides');
        let q;
        if (role === 'rider') {
          q = query(ridesRef, where('rider_id', '==', auth.currentUser.uid));
        } else {
          q = query(ridesRef, where('driver_id', '==', auth.currentUser.uid));
        }

        const snapshot = await getDocs(q);
        const validStatuses = role === 'rider' 
          ? ['requested', 'accepted', 'in_progress'] 
          : ['accepted', 'in_progress'];
          
        const activeRide = snapshot.docs.find(doc => validStatuses.includes(doc.data().status));

        if (activeRide) {
          setActiveRideId(activeRide.id);
        } else {
          setActiveRideId(null);
        }
      } catch (error: any) {
        console.error('Ride recovery failed:', error.message, error.code, error);
      } finally {
        setIsRecovering(false);
      }
    };

    recoverRides();
  }, [isOnline, role]);

  return { activeRideId, isRecovering };
}
