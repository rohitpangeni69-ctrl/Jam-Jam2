import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export class NativePushService {
  private static instance: NativePushService;

  private constructor() {}

  public static getInstance(): NativePushService {
    if (!NativePushService.instance) {
      NativePushService.instance = new NativePushService();
    }
    return NativePushService.instance;
  }

  async initialize(
    onToken: (token: string) => void,
    onPushReceived: (notification: PushNotificationSchema) => void,
    onPushAction: (action: ActionPerformed) => void
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Request permission to use push notifications
      // iOS will prompt user and return if they granted permission or not
      // Android will just grant without prompting
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        throw new Error('User denied permissions!');
      }

      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register();

      // On success, we should be able to receive notifications
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token: ' + token.value);
        onToken(token.value);
      });

      // Some issue with our setup and push will not work
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Error on push registration: ' + JSON.stringify(error));
      });

      // Show us the notification payload if the app is open on our device
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push received: ' + JSON.stringify(notification));
        onPushReceived(notification);
      });

      // Method called when tapping on a notification
      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('Push action performed: ' + JSON.stringify(notification));
        onPushAction(notification);
      });

    } catch (e) {
      console.error('Failed to initialize push notifications:', e);
    }
  }

  async createChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;

    try {
      // Create a high importance channel for Ride Requests
      await PushNotifications.createChannel({
        id: 'ride_requests',
        name: 'Ride Requests',
        description: 'High priority alerts for incoming ride requests',
        importance: 5, // High importance (heads-up notification)
        visibility: 1, // Public visibility
        sound: 'siren.wav', // Custom sound
        vibration: true,
        lights: true,
        lightColor: '#FF0000',
      });
      console.log('Notification channel created');
    } catch (e) {
      console.error('Error creating notification channel:', e);
    }
  }

  async removeAllDeliveredNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await PushNotifications.removeAllDeliveredNotifications();
  }
}

export const nativePush = NativePushService.getInstance();
