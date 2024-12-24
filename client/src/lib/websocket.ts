import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";

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

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed. Reconnecting...');
      setTimeout(() => this.connect(), 3000);
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
  const { toast } = useToast();

  useEffect(() => {
    wsClient.connect();

    const unsubscribe = wsClient.subscribe((message) => {
      if (message.type === 'INVENTORY_UPDATE') {
        const update = message.payload as InventoryUpdate;
        setUpdates(prev => [update, ...prev].slice(0, 10)); // Keep last 10 updates
        
        // Show toast notification for significant changes
        const change = update.quantity - update.previousQuantity;
        const changeText = change > 0 ? `increased by ${change}` : `decreased by ${Math.abs(change)}`;
        
        toast({
          title: "Inventory Update",
          description: `${update.name} stock ${changeText}`,
          variant: change < 0 ? "destructive" : "default",
        });
      }
    });

    return () => unsubscribe();
  }, [toast]);

  return updates;
}
