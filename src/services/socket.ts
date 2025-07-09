import {io, Socket} from 'socket.io-client';
import {storage} from '../utils/storage';
import {config} from '../config';
import {WalletTransaction} from '../store/ordersStore';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  private handlers: {
    setWalletBalance?: (balance: number) => void;
    addWalletTransaction?: (transaction: WalletTransaction) => void;
  } = {};

  getSocket(): Socket | null {
    return this.socket;
  }

  emit(event: string, data: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Socket not connected, cannot emit ${event}`);
    }
  }

  connect(
    branchId: string,
    handlers: {
      setWalletBalance: (balance: number) => void;
      addWalletTransaction: (transaction: WalletTransaction) => void;
    },
  ) {
    if (
      this.socket?.connected &&
      this.socket.io.opts.query?.branchId === branchId
    ) {
      console.log(
        '[Socket] Already connected with same branchId, skipping reconnection',
      );
      return;
    }

    this.handlers = {...handlers};

    try {
      const token = storage.getString('accessToken');
      if (!token) {
        console.log('[Socket] No access token available for socket connection');
        return;
      }

      this.disconnect();

      const socketUrl = config.SOCKET_URL.replace('/api', '');
      console.log('[Socket] Attempting connection to:', socketUrl);

      this.socket = io(socketUrl, {
        query: {branchId},
        extraHeaders: {
          Authorization: `Bearer ${token}`,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true,
      });

      this.setupBasicEventHandlers();

      if (
        this.handlers.setWalletBalance &&
        this.handlers.addWalletTransaction
      ) {
        this.setupWalletHandler(
          this.handlers.setWalletBalance,
          this.handlers.addWalletTransaction,
        );
      }
    } catch (error) {
      console.error('[Socket] Connection Setup Error:', error);
    }
  }

  private setupBasicEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log(
        '[Socket] Connected successfully. Socket ID:',
        this.socket?.id,
      );
      this.isConnected = true;
      this.connectionAttempts = 0;
    });

    this.socket.on('disconnect', reason => {
      console.log('[Socket] Disconnected. Reason:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', error => {
      console.log('[Socket] Connection Error:', error.message);
      this.isConnected = false;
    });

    if (process.env.NODE_ENV === 'development') {
      const ignoredEvents = new Set([
        'ping',
        'pong',
        'connect',
        'disconnect',
        'connect_error',
      ]);
      this.socket.onAny((eventName, ...args) => {
        if (!ignoredEvents.has(eventName)) {
          console.log(
            '[Socket] Event:',
            eventName,
            'Data:',
            typeof args[0] === 'object' ? JSON.stringify(args[0]) : args[0],
          );
        }
      });
    }
  }

  private setupWalletHandler(
    setWalletBalance: (balance: number) => void,
    addWalletTransaction: (transaction: WalletTransaction) => void,
  ) {
    if (!this.socket) return;

    this.socket.on('walletUpdated', ({branchId, newBalance, transaction}) => {
      console.log(`[Socket] Wallet updated for branch ${branchId}`);
      setWalletBalance(newBalance);

      // Check if store needs to be auto-closed due to low balance
      if (newBalance < 100) {
        this.socket?.emit('syncmart:status', {
          storeStatus: 'closed',
          reason: 'Wallet balance below minimum threshold',
        });
      }

      if (transaction) {
        addWalletTransaction({
          ...transaction,
          timestamp: transaction.timestamp,
          status:
            transaction.type === 'platform_charge' ? 'settled' : 'pending',
          orderNumber: transaction.orderId || undefined,
        });
      }
    });

    // Listen for store status updates
    this.socket.on(
      'dkbranch:status',
      (data: {
        storeStatus: 'open' | 'closed';
        balance?: number;
        reason?: string;
      }) => {
        console.log('[Socket] Store status update:', data);
        if (data.balance !== undefined) {
          setWalletBalance(data.balance);
        }
      },
    );
  }

  connectCustomer(
    customerId: string,
    updateOrderCallback: (orderId: string, updatedData: any) => void,
  ) {
    if (!this.socket || !this.socket.connected) {
      const token = storage.getString('accessToken');
      if (!token) {
        console.log('[Socket] No access token available for socket connection');
        return;
      }

      const socketUrl = config.SOCKET_URL.replace('/api', '');
      console.log('[Socket] Attempting customer connection to:', socketUrl);

      this.socket = io(socketUrl, {
        query: {customerId},
        extraHeaders: {
          Authorization: `Bearer ${token}`,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log(
          '[Socket] Customer connected successfully. Socket ID:',
          this.socket?.id,
        );
        this.isConnected = true;
      });

      this.socket.on('orderUpdated', ({orderId, ...updatedData}) => {
        console.log('[Socket] Order updated:', orderId, updatedData);
        updateOrderCallback(orderId, updatedData);
      });

      this.socket.on('disconnect', reason => {
        console.log('[Socket] Customer disconnected. Reason:', reason);
        this.isConnected = false;
      });

      this.socket.on('connect_error', error => {
        console.log('[Socket] Customer connection error:', error.message);
        this.isConnected = false;
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('[Socket] Disconnected and cleaned up');
    }
  }
}

export default new SocketService();
