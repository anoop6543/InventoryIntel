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

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
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

            // Update item in database
            const [updatedItem] = await db
              .update(items)
              .set({ quantity })
              .where(eq(items.id, itemId))
              .returning();

            // Broadcast update to all connected clients
            const updateMessage = JSON.stringify({
              type: 'INVENTORY_UPDATE',
              payload: updatedItem
            });

            wss.clients.forEach((client) => {
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

            wss.clients.forEach((client) => {
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

  // Periodic ping to keep connections alive
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  // Cleanup when server closes
  server.on('close', () => {
    clearInterval(pingInterval);
    wss.close();
  });

  return wss;
}