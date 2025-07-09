import {NativeEventEmitter, NativeModules} from 'react-native';
import { NativeOrder } from '../features/orders/screens/HomeScreen'; // Temporary import

interface OrderSocketInterface {
  connect: (branchId: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  getRecentOrders: (branchId: string) => Promise<any[]>; // Consider defining a stricter type for orders
  setStoreStatus: (isOpen: boolean) => Promise<void>; // Added method
  getPersistedOrders: () => Promise<NativeOrder[]>; // Added method
  setApiBaseUrl: (apiBaseUrl: string) => Promise<boolean>; // Added method to set API base URL
  addListener: (eventType: string) => void;
  removeListeners: (count: number) => void;
}

const OrderSocketModule = NativeModules.OrderSocketModule as OrderSocketInterface;

// Check if the module exists
if (!OrderSocketModule) {
  console.warn('OrderSocketModule native module is not available');
}

export const OrderSocketEventEmitter = new NativeEventEmitter(OrderSocketModule);

export const OrderSocketEvents = {
  NEW_ORDER: 'NEW_ORDER',
  ORDER_UPDATE: 'ORDER_UPDATE',
  WALLET_UPDATED: 'walletUpdated', // Ensure this matches native side
  SOCKET_ERROR: 'SOCKET_ERROR', // For general socket errors
  // Add other events as needed
};

// Exported functions for use in the app
export const OrderSocket = {
  connect: (branchId: string, token: string): Promise<void> => {
    return OrderSocketModule.connect(branchId, token);
  },
  disconnect: (): Promise<void> => {
    return OrderSocketModule.disconnect();
  },
  getRecentOrders: (branchId: string): Promise<any[]> => {
    return OrderSocketModule.getRecentOrders(branchId);
  },
  setStoreStatus: (isOpen: boolean): Promise<void> => { // Added method
    return OrderSocketModule.setStoreStatus(isOpen);
  },
  getPersistedOrders: (): Promise<NativeOrder[]> => {
    return OrderSocketModule.getPersistedOrders();
  },
  setApiBaseUrl: (apiBaseUrl: string): Promise<boolean> => {
    return OrderSocketModule.setApiBaseUrl(apiBaseUrl);
  },
  addListener: (eventName: string, handler: (event: any) => void) => {
    return OrderSocketEventEmitter.addListener(eventName, handler);
  },
  removeListeners: (count: number) => {
    OrderSocketModule.removeListeners(count);
  },
  // It's good practice to also expose a way to remove a single specific listener
  removeSpecificListener: (subscription: any) => {
    if (subscription && typeof subscription.remove === 'function') {
      subscription.remove();
    }
  },
};

export default OrderSocket;
