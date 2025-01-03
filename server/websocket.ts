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

// Helper function to create a new WebSocket server
function createNewWSServer(server: Server) {
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

            // Use a debounce mechanism for broadcasts
            const now = Date.now();
            const lastBroadcast = global.lastInventoryBroadcast || 0;
            
            if (now - lastBroadcast > 60000) { // 1 minute debounce
              global.lastInventoryBroadcast = now;
              const updateMessage = JSON.stringify({
                type: 'INVENTORY_UPDATE',
                payload: update
              });

              wss?.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  (client as any).lastBroadcast = now;
                  client.send(updateMessage);
                }
              });
            }
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
      log("WebSocket connection closed");
    });

    ws.on("error", (error) => {
      log("WebSocket error: " + error);
      clients.delete(ws);
    });
  });

  return wss;
}

export function setupWebSocket(server: Server) {
  return new Promise<{ server: WebSocketServer; cleanup: () => void }>((resolve, reject) => {
    try {
      // Clean up existing WebSocket server if it exists
      if (wss) {
        log("Cleaning up existing WebSocket server");
        const oldWss = wss;
        wss = null;

        // Close all existing connections
        oldWss.clients.forEach(client => {
          client.terminate();
        });

        oldWss.close(() => {
          log("Old WebSocket server closed");
          const newWss = createNewWSServer(server);
          resolve({
            server: newWss,
            cleanup: () => {
              if (newWss) {
                newWss.clients.forEach(client => client.terminate());
                newWss.close(() => {
                  log("WebSocket server cleaned up");
                  wss = null;
                });
              }
            }
          });
        });
      } else {
        const newWss = createNewWSServer(server);
        resolve({
          server: newWss,
          cleanup: () => {
            if (newWss) {
              newWss.clients.forEach(client => client.terminate());
              newWss.close(() => {
                log("WebSocket server cleaned up");
                wss = null;
              });
            }
          }
        });
      }
    } catch (error) {
      log("Error setting up WebSocket server: " + error);
      reject(error);
    }
  });
}