import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { db } from "@db";
import { items } from "@db/schema";
import { eq } from "drizzle-orm";
import { log } from "./vite";

interface WSMessage {
  type: 'INVENTORY_UPDATE' | 'CONNECTION_ACK' | 'ERROR';
  payload: any;
}

interface ClientInfo {
  role: string;
}

let wss: WebSocketServer | null = null;

function createNewWSServer(server: Server) {
  wss = new WebSocketServer({ 
    server,
    path: "/ws",
    host: "0.0.0.0"
  });

  const clients = new Map<WebSocket, ClientInfo>();

  wss.on("connection", async (ws) => {
    log("New WebSocket connection");

    ws.send(JSON.stringify({
      type: 'CONNECTION_ACK',
      payload: { message: 'Connected to inventory management system' }
    }));

    clients.set(ws, { role: 'user' });

    ws.on("message", async (rawMessage) => {
      try {
        const message: WSMessage = JSON.parse(rawMessage.toString());

        switch (message.type) {
          case 'INVENTORY_UPDATE':
            const update = message.payload;
            if (!update?.id || typeof update.quantity !== 'number') {
              ws.send(JSON.stringify({
                type: 'ERROR',
                payload: { message: 'Invalid update format' }
              }));
              return;
            }

            const [currentItem] = await db
              .select()
              .from(items)
              .where(eq(items.id, update.id));

            if (!currentItem) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                payload: { message: 'Item not found' }
              }));
              return;
            }

            // Broadcast update to all connected clients except sender
            const updateMessage = JSON.stringify({
              type: 'INVENTORY_UPDATE',
              payload: {
                id: currentItem.id,
                name: currentItem.name,
                quantity: update.quantity,
                previousQuantity: currentItem.quantity,
                timestamp: new Date().toISOString()
              }
            });

            wss?.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(updateMessage);
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

    ws.on("error", () => {
      clients.delete(ws);
      log("WebSocket connection error");
    });
  });

  return wss;
}

export function setupWebSocket(server: Server) {
  return new Promise<{ server: WebSocketServer; cleanup: () => void }>((resolve) => {
    // Clean up existing WebSocket server if it exists
    if (wss) {
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
  });
}