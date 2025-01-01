
import { useEffect, useState } from 'react';

export interface InventoryUpdate {
  id: number;
  name: string;
  quantity: number;
  previousQuantity: number;
  timestamp: string;
}

export interface WSMessage {
  type: 'INVENTORY_UPDATE' | 'STOCK_ALERT' | 'CONNECTION_ACK' | 'ERROR';
  payload: any;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: WSMessage) => void)[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private lastMessageTimestamp: number = 0;
  private readonly DEBOUNCE_TIME = 5000; // 5 seconds between notifications

  connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        const now = Date.now();
        
        // Only process inventory updates if enough time has passed
        if (message.type === 'INVENTORY_UPDATE') {
          if (now - this.lastMessageTimestamp < this.DEBOUNCE_TIME) {
            return;
          }
          this.lastMessageTimestamp = now;
        }
        
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onopen = () => {
      this.isConnecting = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onclose = () => {
      if (!this.reconnectTimer && !this.isConnecting) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 5000);
      }
      this.isConnecting = false;
      this.ws = null;
    };
  }

  subscribe(handler: (message: WSMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  send(message: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const wsClient = new WebSocketClient();

export function useInventoryNotifications() {
  const [updates, setUpdates] = useState<InventoryUpdate[]>([]);

  useEffect(() => {
    wsClient.connect();
    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'INVENTORY_UPDATE') {
        const update = message.payload as InventoryUpdate;
        setUpdates(prev => [update, ...prev].slice(0, 10));
      }
    });

    return () => unsubscribe();
  }, []);

  return updates;
}
