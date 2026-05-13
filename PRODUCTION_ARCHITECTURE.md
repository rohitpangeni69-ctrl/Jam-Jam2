# NepalRide Production Architecture Roadmap
*7-Day Launch Plan - CTO Playbook*

## 1. Real-Time Ride Matching System
**Tech Stack**: Firestore + `geofire-common`
- **Geohashing**: When a driver goes online, calculate their geohash (`geofire-common`). Store in a `active_drivers` collection.
- **Nearby Queries**: When a rider requests a ride, query `active_drivers` with similar geohash prefixes (e.g., within 5km radius).
- **Live Bidding**: 
  - Create a subcollection `rides/{rideId}/bids`.
  - Drivers listen to new rides in their geohash range. They push a doc to `bids`.
  - Rider listens to `rides/{rideId}/bids` using `onSnapshot`.
- **Acceptance**: Rider clicks Accept -> Cloud Function validates the bid -> assigns `driver_id` to the ride -> changes status to `accepted`.

## 2. Real Driver Tracking
**Tech Stack**: Firebase Realtime Database (RTDB) *NOT* Firestore.
- **Why RTDB?**: Firestore charges per document write. Updating GPS every 5 seconds will bankrupt a startup. RTDB charges by bandwidth, perfect for ephemeral high-frequency data.
- **Flow**: Driver app pushes GPS to `RTDB: /tracking/{rideId}`. Rider app subscribes to `RTDB: /tracking/{rideId}`.
- **Battery**: Use Background Geolocation plugins (Capacitor). Throttle updates to every 10-15 seconds unless moving fast.

## 3. Production Firebase Auth
- **Phone OTP**: Standard in Nepal. Implement Firebase Phone Auth with reCAPTCHA (invisible).
- **Persistence**: `setPersistence(auth, browserLocalPersistence)`.
- **Anti-Spam**: Firebase App Check (Play Integrity on Android) prevents script bots from spamming OTPs.

## 4. Driver Onboarding flow
- **Storage**: Use Firebase Storage for (1) Driving License, (2) Bluebook, (3) Citizenship/Nagarikta.
- **State Machine**: `profiles` collection has `status: 'pending' | 'verified' | 'rejected'`.
- **Rules**: Users can only upload strictly sized images (<2MB) to `/kyc/{userId}/`.

## 5. Ride Lifecycle Architecture
1. `REQUESTED`: Rider creates doc. Geohash is attached.
2. `BROADCASTING`: Cloud Function sends FCM to nearby drivers.
3. `BIDDING`: Drivers write to `bids` subcollection.
4. `ACCEPTED`: Rider picks a bid. Transaction locks the ride.
5. `ARRIVING`: Driver is en route to pickup.
6. `STARTED`: Driver swipes "Start Ride".
7. `COMPLETED`: Driver swipes "End Ride". Wallet is deducted.
8. `CANCELLED`: Either party cancels. (Track cancellation metrics for penalties).

## 6. Firestore Database Design
```javascript
/users/{uid} -> { role: 'rider'|'driver', phone, name, kyc_status, fcm_token }
/wallets/{uid} -> { balance: 0, pending_payout: 0 }
/rides/{rideId} -> { 
   rider_id, driver_id(null), 
   pickup_geohash, pickup_coords, dest_coords,
   status: 'REQUESTED', fare: null, timestamp 
}
/rides/{rideId}/bids/{driverId} -> { amount, eta, rating }
```

## 7. Firebase Cloud Functions (Must Haves)
- `onRideComplete`: Cloud function deducts Rs. from rider's wallet, adds to driver's wallet minus commission (e.g., 10%). *Never trust client for money math.*
- `dispatchRide`: When a ride is created, find nearby drivers and send FCM push notifications.
- `cleanupStaleRides`: Cron job running every 10 mins to mark rides older than 30 mins as `EXPIRED`.

## 8. Push Notifications (FCM)
- Store FCM tokens in a subcollection: `/users/{uid}/tokens/{tokenId}` to support multiple devices.
- Payload: `data: { route: '/ride/123' }` so tapping notification deep-links to the ride page.

## 9. Offline & Reconnect
- **Firestore Offline**: `enableIndexedDbPersistence(db)`. App works briefly in dead zones (common in KTM/Pokhara).
- **Optimistic UI**: When rider clicks 'Cancel', hide the UI immediately, then sync to server.

## 10. Production Wallet System
- **eSewa/Khalti Webhooks**: DO NOT process top-ups on the frontend.
  1. Rider enters amount -> Backend generates signed signature.
  2. Frontend opens eSewa portal.
  3. eSewa completes and pings your Cloud Function webhook `/api/esewa-callback`.
  4. Webhook verifies eSewa signature securely and updates Firestore `/wallets/{uid}`.

## 11. Android Play Store (Capacitor)
- Run `npm install @capacitor/core @capacitor/android`
- `npx cap init` -> `npx cap add android`
- **Permissions**: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` (hardest to get approved, requires video proof for Play Store), `CAMERA` (for KYC).
- Build: `npx cap sync android` -> Open Android Studio -> Build Bundles/APK -> Sign with Keystore.

## 12. Scalability Optimizations
- **Index Optimization**: Explicitly add composite index for `status DESC, timestamp DESC` in Firebase Console.
- **Unsubscribe Listeners**: Ensure `onSnapshot` returns are called in React `useEffect` cleanup loops to avoid memory leaks and 10x read costs.
- **Lazy Loading**: `React.lazy()` for wallet/history pages so the map loads faster on cold starts.
