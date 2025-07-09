import {create} from 'zustand';
import {MMKV} from 'react-native-mmkv';
import io, {Socket} from 'socket.io-client';
import socketService from '../services/socket';

export interface OrderItem {
  item: string;
  count: number;
  price: number;
  _id: string;
}

export interface StatusHistoryItem {
  status: string;
  _id: string;
  timestamp: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

export interface Order {
  _id: string;
  orderId: string;
  items: any[];
  status: string;
  createdAt: string;
  // Add other order properties as needed
}

interface DeliveryPartner {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface Branch {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  name: string;
  phone: string;
  address: {street: string; area: string; city: string; pincode: string};
  location: {type: string; coordinates: [number, number]};
  branchEmail?: string;
  openingTime: string;
  closingTime: string;
  ownerName: string;
  govId: string;
  deliveryServiceAvailable: boolean;
  selfPickup: boolean;
  branchfrontImage: string;
  ownerIdProof: string;
  ownerPhoto: string;
}

// Wallet transaction interface
export interface WalletTransaction {
  _id: string;
  orderId: string;
  orderNumber?: string;
  amount: number;
  type: 'platform_charge' | 'payment';
  timestamp: string;
  status: 'pending' | 'settled';
}

// Wallet payment interface
export interface WalletPayment {
  _id: string;
  amount: number;
  timestamp: string;
  status: 'pending' | 'completed';
}

interface StoreState {
  socket: Socket | null;
  storeStatus: 'open' | 'closed';
  deliveryServiceAvailable: boolean;
  userId: string | null;
  sessionExpiredMessage: string | null;
  orders: Order[];
  deliveryPartners: DeliveryPartner[];
  branches: Branch[];
  walletBalance: number;
  walletTransactions: WalletTransaction[];
  walletPayments: WalletPayment[];
  setStoreStatus: (status: 'open' | 'closed') => void;
  setDeliveryServiceAvailable: (available: boolean) => void;
  setUserId: (id: string | null) => void;
  setSessionExpiredMessage: (message: string | null) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updatedOrder: Order) => void;
  setOrders: (orders: Order[] | ((prevOrders: Order[]) => Order[])) => void;
  setDeliveryPartners: (partners: DeliveryPartner[]) => void;
  addDeliveryPartner: (partner: DeliveryPartner) => void;
  hasApprovedDeliveryPartner: () => boolean;
  addBranch: (branch: Branch) => void;
  updateBranchStatus: (
    branchId: string,
    status: 'pending' | 'approved' | 'rejected',
  ) => void;
  setWalletBalance: (balance: number) => void;
  setWalletTransactions: (transactions: WalletTransaction[]) => void;
  addWalletTransaction: (transaction: WalletTransaction) => void;
  setWalletPayments: (payments: WalletPayment[]) => void;
  addWalletPayment: (payment: WalletPayment) => void;
  initializeSocket: (branchPhone: string) => void;
  disconnectSocket: () => void;
}

const storage = new MMKV();
const STORAGE_KEY = 'deliveryServiceAvailable';

const initialDeliveryServiceAvailable =
  storage.getBoolean(STORAGE_KEY) !== undefined
    ? storage.getBoolean(STORAGE_KEY)
    : false;

export const useStore = create<StoreState>((set, get) => ({
  socket: null,
  storeStatus: 'closed',
  deliveryServiceAvailable: initialDeliveryServiceAvailable || false,
  userId: null,
  sessionExpiredMessage: null,
  orders: [],
  deliveryPartners: [],
  branches: [],
  walletBalance: 0,
  walletTransactions: [],
  walletPayments: [],
  setStoreStatus: status => set({storeStatus: status}),
  setDeliveryServiceAvailable: available => {
    set({deliveryServiceAvailable: available});
    storage.set(STORAGE_KEY, available);
  },
  setUserId: (id: string | null) => {
    set({userId: id});
    if (id) {
      // Connect socket when userId is set
      socketService.connect(id, {
        addOrder: (order: Order) => get().addOrder(order),
        updateOrder: (orderId: string, order: Order) =>
          get().updateOrder(orderId, order),
        setWalletBalance: (balance: number) => get().setWalletBalance(balance),
        addWalletTransaction: (transaction: any) => {
          // Transform the socket transaction to match our WalletTransaction interface
          const walletTransaction: WalletTransaction = {
            _id: transaction._id,
            orderId: transaction.orderId || '',
            orderNumber: transaction.orderNumber || '',
            amount: transaction.amount,
            type: 'charge',
            date: transaction.timestamp || new Date().toISOString(),
            status:
              transaction.type === 'platform_charge' ? 'settled' : 'pending',
          };
          get().addWalletTransaction(walletTransaction);
        },
        orders: get().orders,
      });
    } else {
      socketService.disconnect();
    }
  },
  setSessionExpiredMessage: message => set({sessionExpiredMessage: message}),
  addOrder: order =>
    set(state => {
      if (!order._id) {
        return {orders: [...state.orders, order]};
      }

      const existingOrderIndex = state.orders.findIndex(
        o => o._id === order._id,
      );
      if (existingOrderIndex >= 0) {
        console.log(
          'Order already exists in store, not adding duplicate:',
          order._id,
          'orderID:',
          order.orderID,
        );
        return state;
      }

      console.log(
        'Adding NEW order to store:',
        order._id,
        'orderID:',
        order.orderID,
      );
      return {orders: [...state.orders, order]};
    }),
  updateOrder: (orderId, updatedOrder) =>
    set(state => ({
      orders: state.orders.map(o => (o._id === orderId ? updatedOrder : o)),
    })),
  setOrders: ordersOrFn => {
    if (typeof ordersOrFn === 'function') {
      set(state => ({orders: ordersOrFn(state.orders)}));
    } else {
      set({orders: ordersOrFn});
    }
  },
  setDeliveryPartners: partners => set({deliveryPartners: partners}),
  addDeliveryPartner: partner =>
    set(state => ({deliveryPartners: [...state.deliveryPartners, partner]})),
  hasApprovedDeliveryPartner: () =>
    get().deliveryPartners.some(dp => dp.status === 'approved'),
  addBranch: branch =>
    set(state => ({
      branches: [...state.branches.filter(b => b.id !== branch.id), branch],
    })),
  updateBranchStatus: (branchId, status) =>
    set(state => ({
      branches: state.branches.map(b =>
        b.id === branchId ? {...b, status} : b,
      ),
    })),
  setWalletBalance: balance => set({walletBalance: balance}),
  setWalletTransactions: transactions =>
    set({walletTransactions: transactions}),
  addWalletTransaction: transaction =>
    set(state => ({
      walletTransactions: [...state.walletTransactions, transaction],
    })),
  setWalletPayments: payments => set({walletPayments: payments}),
  addWalletPayment: payment =>
    set(state => ({
      walletPayments: [...state.walletPayments, payment],
    })),
  initializeSocket: (branchPhone: string) => {
    const socket = io('YOUR_BACKEND_URL'); // Replace with your actual backend URL

    // Join branch-specific room
    socket.emit('joinSyncmartRoom', branchPhone);

    // Listen for new orders
    socket.on('newOrder', (order: Order) => {
      console.log('New order received via socket:', order._id);
      get().addOrder(order);
    });

    // Listen for order status updates
    socket.on('orderStatusUpdate', (updatedOrder: Order) => {
      console.log('Order update received via socket:', updatedOrder._id);
      get().updateOrder(updatedOrder._id, updatedOrder);
    });

    set({socket});
  },

  disconnectSocket: () => {
    const {socket} = get();
    if (socket) {
      socket.disconnect();
      set({socket: null});
    }
  },
}));
