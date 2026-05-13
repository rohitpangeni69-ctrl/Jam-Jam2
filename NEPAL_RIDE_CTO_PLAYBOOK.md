# NepalRide - 7-Day CTO Playbook & Production Architecture

As a team of senior engineers (Firebase Architect, React Native Lead, DevOps, CTO), we have developed this 7-day launch blueprint to transition NepalRide from a raw MVP into a resilient, highly-scalable platform optimized for Nepal's market conditions (flaky 3G/4G, diverse Android devices, local payment ecosystems).

---

## PHASE 1 — REAL-TIME RIDE ENGINE

### 1. Firestore Schema & Design
**Why:** Firestore charges by document reads. We must separate dense data from frequently updated data. 

```javascript
/* FIRESTORE COLLECTIONS & SCHEMA */

// users (Riders and Drivers)
/users/{uid} 
  -> { role: 'rider'|'driver', phone: '+977...', name, status: 'active', fcm_token }

// driver_kyc (Only accessed by admins and driver onboarding)
/driver_kyc/{uid} 
  -> { license_url, bluebook_url, citizenship_url, status: 'pending'|'verified'|'rejected', updated_at }

// active_rides (Lifecycle state machine for current rides)
/active_rides/{rideId} 
  -> { 
    rider_id, driver_id(null),
    pickup: { lat, lng, geohash, address },
    dropoff: { lat, lng, address },
    status: 'requested'|'bidding'|'accepted'|'arriving'|'started',
    distance_km, estimated_fare,
    created_at
  }

// active_rides subcollection (The Bids)
/active_rides/{rideId}/bids/{driver_id} 
  -> { amount, eta_mins, driver_rating, timestamp }

// ride_history (Moved here after completion to keep active_rides collection small)
/ride_history/{rideId} 
  -> { ...activeRideData, status: 'completed'|'cancelled', final_fare, completed_at }

// wallets
/wallets/{uid} 
  -> { balance: 0, currency: 'NPR', updated_at }
```

### 2. Real-Time Matching & Broadcasting
**Architecture:** When a rider requests a ride, the frontend converts the pickup coordinate into a `geohash` (using `geofire-common`).
**Driver Discovery:** Drivers run a listener on `active_rides` where `status == 'requested'` and `pickup.geohash` is between a calculated `[start, end]` string boundary (representing a 3-5km radius).
**Optimization:** Only nearby drivers download the ride document. If no one bids in 60s, a Cloud Function expands the radius or expires the ride.

### 3. Live Bidding System
**Flow:**
1. Driver sees broadcasted ride -> enters amount -> writes to `/active_rides/{rideId}/bids/{driver_id}`.
2. Rider UI listens to `collection(db, 'active_rides', rideId, 'bids')`.
3. Rider accepts a bid -> Updates `active_rides/{rideId}` setting `driver_id = selected_driver`, `final_fare = bid.amount`, `status = 'accepted'`.
4. Security Rules strictly enforce that *only* the rider who created the ride can update the `driver_id` and `status`.

### 4. Ride Lifecycle State Machine
* **REQUESTED**: Rider creates doc. Time-to-Live (TTL) is 5 mins.
* **BIDDING**: Drivers add documents to the `bids` subcollection.
* **ACCEPTED**: Rider picks a bid. Ride locks to that driver.
* **ARRIVING**: Driver presses "Navigating". Rider sees driver moving towards pickup.
* **STARTED**: Driver enters OTP provided by rider to start the trip (anti-fraud).
* **COMPLETED**: Driver swipes end. Firebase Function charges wallet.
* **CANCELLED**: If cancelled by driver after 'accepted', penalty logic triggers via Cloud Function.

### 5. Driver Live Tracking (The Map)
**Architecture:** DO NOT track live GPS in Firestore. You will burn cash instantly. 
**Realtime Database (RTDB):** Use RTDB for ephemeral location updates. `RTDB: /locations/{rideId}/ { lat, lng, heading }`.
**Optimizations:** Driver app throttles updates to every 5-10 seconds. RTDB charges by bandwidth, not reads/writes. This gives buttery smooth tracking for pennies.

---

## PHASE 2 — PRODUCTION AUTH

**Implementation Strategy:**
1. **Phone Auth**: Replaced Google Auth with standard Firebase Phone Auth (`signInWithPhoneNumber`) utilizing invisible reCAPTCHA. Essential for Nepal (+977).
2. **Persistence**: `setPersistence(auth, browserLocalPersistence)` ensures riders don't get logged out mid-ride.
3. **Anti-Spam**: Firebase App Check enforced. OTPs are expensive; App Check requires Play Integrity (Android) to block unauthorized bot traffic.

---

## PHASE 3 — DRIVER ONBOARDING + KYC

1. **Flow**: Driver Signs Up -> Redirected to KYC form (cannot accept rides).
2. **Storage**: Images uploaded to `gs://{bucket}/kyc/{uid}/license.jpg`.
3. **Approval**: Admin hits a custom endpoint that sets `/users/{uid}/role = 'driver'` and `/driver_kyc/{uid}/status = 'verified'`.
4. **Fraud Check**: Require "Selfie with Bluebook" to prevent stolen vehicle registrations.

---

## PHASE 4 — FIREBASE CLOUD FUNCTIONS

**Crucial Backend Logic (Node.js):**
1. `onRideComplete(rideId)`: Triggered when ride status -> `completed`. Deducts `ride.final_fare` from `/wallets/{riderId}` and credits `/wallets/{driverId}` minus a 15% platform commission.
2. `cleanupStaleRides`: A Scheduled Function (cron job) runs every 10 mins. Checks `/active_rides` where `created_at < now - 30mins`. Moves them to history as `cancelled` to keep queries fast.

---

## PHASE 5 — PUSH NOTIFICATIONS (FCM)

**Why FCM?** Android battery managers (like Xiaomi/Oppo prevalent in Nepal) aggressively kill background processes. Data messages (FCM) wake the app up natively.
**Events**:
* **Driver**: "New Ride Request (3km away)" (Wake up screen -> sound chime).
* **Rider**: "Driver corresponds to your bid!" -> Tapping opens app directly to bidding UI.

---

## PHASE 6 — WALLET + PAYMENTS

1. **eSewa Integration**: 
   - Rider clicks "Load Rs. 500".
   - Cloud Function creates an `esewa_signature` and transaction intent `TxID_123`.
   - Rider redirected to eSewa portal. eSewa hits our Cloud Function Webhook upon success.
   - Webhook verifies payload and increments `/wallets/{uid}`.
2. **Cash Option**: Since Nepal is heavily cash-based, allow rides to be marked "Cash". The 15% commission is simply deducted from the driver's *pre-loaded developer wallet*. If driver wallet drops below Rs. -200, they are suspended.

---

## PHASE 7 — FIRESTORE SECURITY RULES

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Shared functions
    function isValid() { return request.auth != null; }
    
    // active_rides: strictly constrained
    match /active_rides/{rideId} {
      // Rider can create, Driver can only read if nearby
      allow create: if isValid() && request.resource.data.rider_id == request.auth.uid;
      // Rider can update status to 'accepted', Driver can update status to 'arriving'|'started'
      allow update: if isValid() && (
        (request.resource.data.rider_id == request.auth.uid) || 
        (resource.data.driver_id == request.auth.uid)
      );
    }
  }
}
```

---

## PHASE 8 — ANDROID DEPLOYMENT

**Capacitor Setup**: App wrapper to map web tech to native Android.
1. Add plugins: `@capacitor/geolocation`, `@capacitor/push-notifications`, `@capacitor/network`.
2. **Background GPS**: Android 14+ requires foreground services for GPS tracking. Capacitor Background Geolocation plugin is mandatory so the driver's phone sends RTDB updates even when screen is locked.
3. App Bundle generated -> Play Store internal testing track.

---

## PHASE 9 — PERFORMANCE + SCALE

1. **Lazy Loading**: Route-level code splitting using Vite so downloading the initial JS bundle on 3G takes <2 seconds.
2. **Images**: Request all uploaded driver SVGs/Avatars with `.webp` compression.
3. **Reconnection**: `onSnapshot` from Firebase handles standard disconnects beautifully, caching the latest known state locally via `enableIndexedDbPersistence()`.

---

## PHASE 10 — NEPAL MARKET OPTIMIZATION

**The CTO Playbook Strategy:**
1. **Low-End Android Focus**: Heavy reliance on local state management (Zustand or React Context) instead of massive DOM repaints. Keep CSS animations simple.
2. **Localization**: Dual language support (Nepali/English toggle). Especially useful for older drivers.
3. **Referral Focus**: "Give Rs. 50, Get Rs. 50" wallet incentive for user acquisition, standard growth-hack to beat Pathao.
4. **Start Small**: Launch specifically in the Ring Road area first to ensure high liquidity (driver density) before expanding outwards.
