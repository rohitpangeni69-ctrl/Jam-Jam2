import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function requestNotificationPermission(): Promise<string | null> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // For development in standard preview without a real VAPID key
      // we'll just use a mock token.
      const currentToken = 'mock-token-for-dev-' + Date.now();
      
      if (currentToken) {
        await saveTokenToFirestore(currentToken);
        return currentToken;
      }
    }
    return null;
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
    return null;
  }
}

async function saveTokenToFirestore(token: string) {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const tokenDocRef = doc(db, 'users', uid);

  // Using deterministic token key to avoid duplicate arrays
  const tokenKey = token.substring(0, 16); 
  
  await setDoc(
    tokenDocRef,
    {
      fcm_tokens: {
        [tokenKey]: {
          token: token,
          platform: 'web', // typically Capacitor would send 'android' or 'ios'
          updated_at: new Date().toISOString(),
          app_version: '1.0.0'
        }
      }
    },
    { merge: true }
  );
}

/**
 * Listen for foreground messages. 
 * Expected payload: { data: { type: 'new_ride_dispatch', rideId: '...', ... } }
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  // In development/preview environment without full config
  // (like messagingSenderId), getMessaging() can throw unhandled errors.
  // We'll rely on our Firestore fallback instead.
  return () => {};
}
