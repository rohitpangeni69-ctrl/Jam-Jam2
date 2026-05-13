import { Geolocation, Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// In a real production app, this would use a background geolocation plugin
// like @transistorsoft/capacitor-background-geolocation or capacitor-background-geolocation

export interface LocationOptions {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

export class NativeLocationService {
  private static instance: NativeLocationService;
  private watchId: string | null = null;
  private isTracking = false;

  private constructor() {}

  public static getInstance(): NativeLocationService {
    if (!NativeLocationService.instance) {
      NativeLocationService.instance = new NativeLocationService();
    }
    return NativeLocationService.instance;
  }

  async initialize(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;

    try {
      const permission = await Geolocation.checkPermissions();
      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          console.warn('Location permission denied');
          return false;
        }
      }
      return true;
    } catch (e) {
      console.error('Failed to initialize location service:', e);
      return false;
    }
  }

  async getCurrentPosition(): Promise<Position | null> {
    try {
      return await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    } catch (e) {
      console.error('Error getting current position:', e);
      return null;
    }
  }

  async startTracking(onChange: (position: Position) => void, onError?: (error: any) => void): Promise<void> {
    if (this.isTracking) return;

    try {
      this.watchId = await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }, (position, err) => {
        if (err) {
          if (onError) onError(err);
          return;
        }
        if (position) {
          onChange(position);
        }
      });
      this.isTracking = true;

      // Handle background behavior
      if (Capacitor.isNativePlatform()) {
        App.addListener('appStateChange', (state) => {
          if (!state.isActive) {
            console.log('App went to background, GPS tracking is critical for rides...');
            // In Android, ensure foreground service is running so this doesn't get killed
          }
        });
      }
    } catch (e) {
      if (onError) onError(e);
      console.error('Failed to start tracking:', e);
    }
  }

  async stopTracking(): Promise<void> {
    if (this.watchId !== null) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
      this.isTracking = false;
    }
  }
}

export const nativeLocation = NativeLocationService.getInstance();
