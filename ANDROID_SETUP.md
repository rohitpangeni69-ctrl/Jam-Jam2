# Android Hardening & Deployment Checklist for JamJam

## 1. Native Setup & Configuration
To finalize the Android build, synchronize the web assets to the native Android project:
```bash
npx cap add android
npx cap sync android
```

## 2. Android Manifest Hardening (`android/app/src/main/AndroidManifest.xml`)
Add the following permissions and declarations to survive OEM process killing and background limits:

```xml
<!-- Required for GPS -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<!-- Required for background GPS on Android 10+ -->
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Foreground Service for tracking during rides -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Prevent Doze Mode killing notifications/GPS -->
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

<!-- Push Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

Also, declare the Receiver and Foreground Service inside the `<application>` tag:
```xml
<service
    android:name="com.jamjam.rideshare.LocationForegroundService"
    android:foregroundServiceType="location"
    android:enabled="true"
    android:exported="false" />
```

## 3. Battery Optimization (OEM Handling)
Xiaomi, Oppo, and Vivo devices aggressively kill background services, which halts GPS tracking.
- We have implemented detection in `src/lib/native/background.ts`.
- When an aggressive OEM is detected, the app explicitly asks the user to either:
  1. Add the app to "Auto Start"
  2. Set Battery Saver restrictions to "No Restrictions"

## 4. Play Store Compliance (CRITICAL)
Google Play will reject the app if Background Location and Foreground Services are abused or poorly disclosed.

**Disclosure Screen**:
Before requesting `ACCESS_BACKGROUND_LOCATION`, you MUST show a prominent disclosure in the UI.
Example: *"JamJam collects location data even when the app is closed or not in use to enable ride dispatch, allow passengers to track your vehicle, and calculate fares accurately."*

**Privacy Policy**:
Update your website privacy policy to reflect exactly how background location data is used, stored, and deleted.

## 5. Deployment Build Pipeline
Generate an AAB (Android App Bundle) for the Play Store instead of an APK.
1. `npm run build`
2. `npx cap sync android`
3. `cd android && ./gradlew bundleRelease`
4. Sign the AAB using `jarsigner` with your production keystore.

## 6. Cold-Start and Background Recovery
If the OS kills the app due to memory constraints:
- Remote Messages (FCM) via `@capacitor/push-notifications` will wake up the app.
- Upon restarting (handled in `src/lib/native/background.ts`), the web view restores the active ride from Firebase RTDB and resumes tracking automatically.

## 7. Crashlytics & Analytics (Native Integration)
Add native error tracking to survive Web View crashes:
```bash
npm install @capacitor-firebase/crashlytics @capacitor-firebase/analytics
npx cap sync
```
Ensure you add the `google-services.json` generated from Firebase Console to `android/app/google-services.json`. The Capacitor plugins will forward native and JS crash logs seamlessly.
