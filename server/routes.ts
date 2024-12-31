import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { items, auditLogs, suppliers, purchaseOrders, purchaseOrderItems } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { setupWebSocket } from "./websocket";
import { automationService } from "./services/inventory-automation";
import { log } from "./vite";

export function registerRoutes(app: Express): Server {
  // Create HTTP server first
  const httpServer = createServer(app);

  // Setup WebSocket after HTTP server is created
  const wsServer = setupWebSocket(httpServer);

  // Cleanup function for server shutdown
  const cleanup = () => {
    wsServer.cleanup();
    httpServer.close();
  };

  // Inventory management routes with auth checks
  app.get("/api/items", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authorized");
    }
    const allItems = await db.select().from(items);
    res.json(allItems);
  });

  app.post("/api/items", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role === "user") {
      return res.status(401).send("Not authorized");
    }

    const item = req.body;
    const [newItem] = await db.insert(items).values(item).returning();

    await db.insert(auditLogs).values({
      userId: req.user.id,
      itemId: newItem.id,
      action: "created",
      newValue: JSON.stringify(newItem),
    });

    res.json(newItem);
  });

  app.put("/api/items/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role === "user") {
      return res.status(401).send("Not authorized");
    }

    const id = parseInt(req.params.id);
    const updates = req.body;

    const [oldItem] = await db.select().from(items).where(eq(items.id, id));
    const [updatedItem] = await db
      .update(items)
      .set(updates)
      .where(eq(items.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: req.user.id,
      itemId: id,
      action: "updated",
      oldValue: JSON.stringify(oldItem),
      newValue: JSON.stringify(updatedItem),
    });

    res.json(updatedItem);
  });

  app.get("/api/items/low-stock", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authorized");
    }

    const lowStockItems = await db.select()
      .from(items)
      .where(sql`quantity <= min_quantity`);

    res.json(lowStockItems);
  });

  // Add automation-related routes
  app.post("/api/automation/reorder-check", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(401).send("Not authorized");
    }

    try {
      await automationService.runAutomationCheck();
      res.json({ message: "Automation check completed successfully" });
    } catch (error) {
      log(`Error running automation check: ${error}`);
      res.status(500).json({ message: "Failed to run automation check" });
    }
  });

  app.get("/api/purchase-orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authorized");
    }

    const orders = await db.select()
      .from(purchaseOrders)
      .orderBy(desc(purchaseOrders.orderedAt))
      .limit(50);

    res.json(orders);
  });

  app.get("/api/purchase-orders/:id/items", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authorized");
    }

    const orderId = parseInt(req.params.id);
    const orderItems = await db.select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

    res.json(orderItems);
  });

  // Attach cleanup to server
  httpServer.on('close', cleanup);

  return httpServer;
}