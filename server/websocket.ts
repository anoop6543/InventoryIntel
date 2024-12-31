import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { db } from "@db";
import { items } from "@db/schema";
import { eq } from "drizzle-orm";
import { log } from "./vite";

interface WSMessage {
  type: 'INVENTORY_UPDATE' | 'STOCK_ALERT' | 'CONNECTION_ACK' | 'ERROR';
  payload: any;
}

interface ClientInfo {
  role: string;
}

interface InventoryUpdate {
  id: number;
  name: string;
  quantity: number;
  previousQuantity: number;
  timestamp: string;
}

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server) {
  // Clean up existing WebSocket server if it exists
  if (wss) {
    log("Cleaning up existing WebSocket server");
    wss.clients.forEach(client => {
      client.terminate();
    });
    wss.close();
    wss = null;
  }

  wss = new WebSocketServer({ 
    server,
    path: "/ws",
    host: "0.0.0.0"
  });

  // Store connected clients with their roles
  const clients = new Map<WebSocket, ClientInfo>();

  wss.on("connection", async (ws) => {
    log("New WebSocket connection");

    // Send acknowledgment
    ws.send(JSON.stringify({
      type: 'CONNECTION_ACK',
      payload: { message: 'Connected to inventory management system' }
    }));

    // Add client to connected clients
    clients.set(ws, { role: 'user' });

    ws.on("message", async (rawMessage) => {
      try {
        const message: WSMessage = JSON.parse(rawMessage.toString());

        switch (message.type) {
          case 'INVENTORY_UPDATE':
            // Validate and process inventory update
            const { itemId, quantity } = message.payload;
            if (typeof itemId !== 'number' || typeof quantity !== 'number') {
              ws.send(JSON.stringify({
                type: 'ERROR',
                payload: { message: 'Invalid update format' }
              }));
              return;
            }

            // Get the current item data
            const [currentItem] = await db
              .select()
              .from(items)
              .where(eq(items.id, itemId));

            if (!currentItem) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                payload: { message: 'Item not found' }
              }));
              return;
            }

            // Update item in database
            const [updatedItem] = await db
              .update(items)
              .set({ quantity })
              .where(eq(items.id, itemId))
              .returning();

            // Create inventory update message
            const update: InventoryUpdate = {
              id: updatedItem.id,
              name: updatedItem.name,
              quantity: updatedItem.quantity,
              previousQuantity: currentItem.quantity,
              timestamp: new Date().toISOString()
            };

            // Broadcast update to all connected clients
            const updateMessage = JSON.stringify({
              type: 'INVENTORY_UPDATE',
              payload: update
            });

            wss?.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(updateMessage);
              }
            });
            break;

          case 'STOCK_ALERT':
            // Broadcast stock alerts to admin clients
            const alertMessage = JSON.stringify({
              type: 'STOCK_ALERT',
              payload: message.payload
            });

            wss?.clients.forEach((client) => {
              const clientInfo = clients.get(client);
              if (client.readyState === WebSocket.OPEN && clientInfo?.role === 'admin') {
                client.send(alertMessage);
              }
            });
            break;
        }
      } catch (error) {
        log('Error processing WebSocket message: ' + error);
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid message format' }
        }));
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    // Handle errors
    ws.on("error", (error) => {
      log("WebSocket error: " + error);
      clients.delete(ws);
    });
  });

  // Cleanup function
  const cleanup = () => {
    if (wss) {
      wss.clients.forEach(client => {
        client.terminate();
      });
      wss.close();
      wss = null;
    }
  };

  // Handle server shutdown
  server.on('close', cleanup);

  return {
    server: wss,
    cleanup
  };
}