import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

export class NativeBackgroundService {
  private static instance: NativeBackgroundService;

  private constructor() {}

  public static getInstance(): NativeBackgroundService {
    if (!NativeBackgroundService.instance) {
      NativeBackgroundService.instance = new NativeBackgroundService();
    }
    return NativeBackgroundService.instance;
  }

  async setupBackgroundRecovery(onRecover: () => void): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    // Listen to app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active?', isActive);
      if (isActive) {
        // App returned to foreground, or was recovered from being killed
        console.log('App recovered from background. Attempting to restore state...');
        onRecover();
      }
    });

    // Listen to restored state for when OS kills the app in background but user navigated back
    App.addListener('restoredResult', data => {
      console.log('Restored state:', data);
      onRecover();
    });
  }

  async checkBatteryOptimization(): Promise<boolean> {
    // This requires a custom Capacitor plugin or community plugin in production.
    // E.g., @robingenz/capacitor-android-battery-optimization
    // This allows us to detect devices (Xiaomi/Oppo/Vivo/Huawei) and prompt the user to disable battery optimization.
    
    if (Capacitor.getPlatform() !== 'android') return false;

    // Mock implementation for checking battery optimization
    const deviceInfo = await Device.getInfo();
    console.log('Device Manufacturer:', deviceInfo.manufacturer);

    const aggressiveOEMs = ['xiaomi', 'oppo', 'vivo', 'huawei'];
    const isAggressive = aggressiveOEMs.includes(deviceInfo.manufacturer.toLowerCase());

    if (isAggressive) {
      console.warn('Running on aggressive OEM. Recommend disabling battery optimization.');
      // Return true to trigger UI prompt
      return true;
    }

    return false;
  }

  async requestIgnoreBatteryOptimizations(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    
    console.log('Requesting to ignore battery optimizations...');
    // Real implementation requires Android-specific intent call.
    // e.g. ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
  }
  
  async openAutoStartSettings(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    
    console.log('Opening AutoStart settings...');
    // Deep link into OEM-specific auto-start settings screens
  }
}

export const nativeBackground = NativeBackgroundService.getInstance();
