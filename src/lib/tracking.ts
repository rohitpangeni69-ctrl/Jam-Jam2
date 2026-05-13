import { rtdb } from './firebase';
import { ref, set, onValue, off, serverTimestamp } from 'firebase/database';

export interface LocationUpdate {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  updatedAt?: any;
}

let lastPublishTime: Record<string, number> = {};

/**
 * Pushes the driver's current high-frequency GPS location to Realtime Database.
 * RTDB is used here (instead of Firestore) as it is billed by bandwidth, not per-write,
 * reducing cost by 99% for live tracking.
 * Throttles updates to every ~5 seconds to save battery and data.
 */
export function publishDriverLocation(rideId: string, location: LocationUpdate) {
  if (!rideId) return;

  const now = Date.now();
  if (lastPublishTime[rideId] && now - lastPublishTime[rideId] < 5000) {
    // Throttle updates (only send every 5 seconds)
    return;
  }
  lastPublishTime[rideId] = now;

  const locationRef = ref(rtdb, `driver_locations/${rideId}`);
  set(locationRef, {
    ...location,
    updatedAt: serverTimestamp(),
  }).catch((err) => console.error("RTDB update failed:", err));
}

/**
 * Subscribes the rider's map to the driver's live GPS coordinates.
 * Returns an unsubscribe function to cleanup the listener.
 */
export function subscribeToDriverLocation(rideId: string, callback: (loc: LocationUpdate) => void) {
  if (!rideId) return () => {};
  
  const locationRef = ref(rtdb, `driver_locations/${rideId}`);
  
  onValue(locationRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });

  return () => {
    off(locationRef);
  };
}
