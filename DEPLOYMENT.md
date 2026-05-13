# JamJam Production Scale & Security Hardening

## Firebase Cost & Scale Adjustments
### Protect Against Runaway Reads/Writes
- **Listener Explosions:** We have ensured `ActiveRidePage` uses `onSnapshot` with careful unmount discipline to avoid memory leaks and ghost reads.
- **Hot Collection Scans:** Firestore paths use specific `where` equality checks indexed properly via `firestore.indexes.json` to prevent full table scans on `/rides`.
- **Fanout Storms:** Bulk notifications are handled via batched FCM in Node.js instead of client fanouts.
- **Unbounded Retries:** `retryQueue.ts` strictly bounds execution attemps.

## Observability & Errors
- Integrated `@capacitor-firebase/crashlytics` for hard native Web View crashes.
- Unhandled Promise Rejections & window errors capture standard JS faults and route them to analytics endpoints.
- Rate Limit traces and Fraud Flags are tracked via Firebase Logger in Cloud Functions (`functions/src/security.ts`).

## Security
- `functions/src/security.ts` acts as middleware preventing unauthenticated or App Check failing requests from triggering.
- Client-side tampering of Wallet Balances is mitigated using backend reconciliation (`functions/src/reconciliation.ts`).
- Bidding spams and Fake Ride Loops are managed by Sliding Window Rate Limiters (`functions/src/rateLimit.ts` and `SecurityUtils.detectAnomalies`).

## Deployment Checklist
1. **Firebase App Check:** Register reCAPTCHA Enterprise for Web and Play Integrity for Android in the Firebase Console.
2. **Secrets:** Add `ESEWA_MERCHANT_ID` and `CRON_SECRET` to Google Cloud Secret Manager.
3. **Environment Segregation:** Separate Firebase projects (`jamjam-staging` & `jamjam-prod`).
4. **Deploy Indexes:** Execute `firebase firestore:indexes > firestore.indexes.json` periodically and deploy them via `firebase deploy --only firestore:indexes`.

## Load Test Simulator
A utility has been included at `src/lib/loadSimulator.ts` which is stripped in prod builds, letting QA mock dispatch spikes and massive driver registrations for latency telemetry.
