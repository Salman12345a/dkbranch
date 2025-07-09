import {NativeModules, Platform, NativeEventEmitter} from 'react-native';

// Interface for the native module
interface FloatingOverlayInterface {
  showOverlay(isStoreOpen: boolean, orderCount: number): void;
  updateOverlay(isStoreOpen: boolean, orderCount: number): void;
  hideOverlay(): void;
  requestOverlayPermission(): Promise<boolean>;
  isOverlayShowing(): Promise<boolean>;
  checkOverlayPermission(): Promise<boolean>;
}

// Events that can be emitted by the native module
export enum FloatingOverlayEvents {
  OVERLAY_CLICKED = 'OVERLAY_CLICKED',
}

// Default implementation if the native module is not available
const defaultImplementation: FloatingOverlayInterface = {
  showOverlay: () => console.warn('FloatingOverlay is not available'),
  updateOverlay: () => console.warn('FloatingOverlay is not available'),
  hideOverlay: () => console.warn('FloatingOverlay is not available'),
  requestOverlayPermission: () => Promise.resolve(false),
  isOverlayShowing: () => Promise.resolve(false),
  checkOverlayPermission: () => Promise.resolve(false),
};

// Get the native module or use the default implementation
export const FloatingOverlay: FloatingOverlayInterface =
  Platform.OS === 'android' || Platform.OS === 'ios'
    ? NativeModules.FloatingOverlayModule || defaultImplementation
    : defaultImplementation;

// Create an event emitter for the native module
export const FloatingOverlayEventEmitter = NativeModules.FloatingOverlayModule
  ? new NativeEventEmitter(NativeModules.FloatingOverlayModule)
  : null;
