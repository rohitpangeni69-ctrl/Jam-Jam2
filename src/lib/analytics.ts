import { app } from './firebase';
import { getAnalytics, logEvent, Analytics, isSupported } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

let analytics: Analytics | null = null;

export const initAnalytics = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAnalytics.setCollectionEnabled({ enabled: true });
      console.log('Native Analytics initialized.');
    } catch (e) {
      console.warn('Native Analytics init failed', e);
    }
  } else if (typeof window !== 'undefined') {
    try {
      const supported = await isSupported();
      if (supported) {
        analytics = getAnalytics(app);
        console.log('Web Analytics initialized.');
      } else {
        console.warn('Web Analytics is not supported in this environment.');
      }
    } catch (e) {
      console.warn('Failed to initialize web analytics', e);
    }
  }
};

export const trackEvent = async (eventName: string, eventParams?: Record<string, any>) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAnalytics.logEvent({ name: eventName, params: eventParams });
      console.log(`[Native Analytics Event] ${eventName}`);
    } catch (e) {
      console.error('Failed to log native event', e);
    }
  } else if (analytics) {
    logEvent(analytics, eventName, eventParams);
  } else {
    console.log(`[Analytics Event] ${eventName}`, eventParams);
  }
};
