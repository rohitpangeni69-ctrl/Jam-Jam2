import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

export const initCrashReporting = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseCrashlytics.setCrashlyticsCollectionEnabled({ enabled: true });
      console.log('Native Crashlytics initialized.');
    } catch (e) {
      console.warn('Native Crashlytics init failed', e);
    }
  } else {
    // Listen for unhandled promise rejections on web
    window.addEventListener('unhandledrejection', (event) => {
      logError('unhandled_rejection', event.reason);
    });
    window.addEventListener('error', (event) => {
      logError('window_error', event.error);
    });
    console.log('Web crash handlers initialized.');
  }
};

export const logError = async (context: string, error: any) => {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseCrashlytics.recordException({ message: `${context}: ${errorMsg}`, stacktrace: errorStack });
    } catch (e) {
      console.error(`[Native Crashlytics] Fallback logging ${context}:`, errorMsg);
    }
  } else {
    // Log to custom backend or external service for web
    console.error(`[Web Crash] ${context}:`, errorMsg, errorStack);
  }
};

export const logWarning = (context: string, message: string) => {
  if (Capacitor.isNativePlatform()) {
    FirebaseCrashlytics.log({ message: `[Warning] ${context}: ${message}` }).catch(console.warn);
  } else {
    console.warn(`[Warning] ${context}:`, message);
  }
};
