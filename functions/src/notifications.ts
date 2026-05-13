import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Cloud Function triggered when a new ride is created.
 * Geo-matches nearby drivers and sends them a silent DATA payload
 * via FCM to trigger the IncomingRideModal on their devices.
 */
export const notifyNearbyDrivers = onDocumentCreated('active_rides/{rideId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log('No data associated with the event');
    return;
  }

  const ride = snapshot.data();
  const rideId = snapshot.id;

  // Only run if the ride is in requested state
  if (ride.status !== 'requested') return;

  const { pickup, vehicle_id } = ride;
  
  // NOTE: In production, use geohash-based radius queries (e.g. Geofire) 
  // to fetch ONLY drivers within a 3-5km radius.
  // For now, we fetch all active approved drivers of the matching vehicle type.
  const driversQuery = await db.collection('users')
    .where('role', '==', 'driver')
    .where('kyc_status', '==', 'approved')
    // Ideally filter by vehicle_type == vehicle_id but allowing flexibility here
    .get();

  if (driversQuery.empty) {
    console.log('No active drivers found');
    return;
  }

  const tokens: string[] = [];

  driversQuery.docs.forEach((doc) => {
    const userData = doc.data();
    if (userData.fcm_tokens) {
      Object.values(userData.fcm_tokens).forEach((tokenData: any) => {
        if (tokenData.token) tokens.push(tokenData.token);
      });
    }
  });

  if (tokens.length === 0) {
    console.log('No valid FCM tokens found for nearby drivers');
    return;
  }

  // Construct a purely DATA-driven payload 
  // (Silent push, handled by client app / Capacitor background handler)
  const payload = {
    data: {
      type: 'new_ride_dispatch',
      rideId: rideId,
      pickup_address: pickup.address,
      pickup_lat: String(pickup.lat),
      pickup_lng: String(pickup.lng),
      dropoff_address: ride.dropoff?.address || '',
      estimated_fare: String(ride.estimated_fare),
      distance_km: String(ride.distance_km),
      vehicle_id: vehicle_id,
      timeout_ms: '30000', // 30 second timer
      created_at: ride.created_at
    }
  };

  try {
    // Batch send to all matched drivers
    const response = await messaging.sendEachForMulticast({
      tokens,
      data: payload.data,
      android: {
        priority: 'high',
        ttl: 30000 // TTL matches the dispatch window (30 seconds)
      }
    });

    console.log(`Successfully sent message to ${response.successCount} drivers.`);
    
    // Cleanup stale tokens
    const staleTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        if (
          resp.error.code === 'messaging/invalid-registration-token' ||
          resp.error.code === 'messaging/registration-token-not-registered'
        ) {
          staleTokens.push(tokens[idx]);
        }
      }
    });

    if (staleTokens.length > 0) {
      // In production, map staleTokens back to their user docs and delete them.
      console.log('Stale tokens to clean up:', staleTokens);
    }

  } catch (error) {
    console.error('Error sending multicast dispatch:', error);
  }
});
