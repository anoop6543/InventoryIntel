
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { items, auditLogs } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import nodemailer from "nodemailer";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  app.post("/api/notify-supplier", async (req, res) => {
    const lowStockItems = req.body;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "your-email@gmail.com",
        pass: "your-email-password",
      },
    });

    const itemsList = lowStockItems
      .map((item) => `${item.name} (SKU: ${item.sku}) x${item.quantity}`)
      .join("\n");

    const mailOptions = {
      from: "your-email@gmail.com",
      to: "supplier-email@example.com",
      subject: "Low Stock Alert",
      text: `The following items are below minimum stock:\n${itemsList}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).send("Notification sent successfully");
    } catch (error) {
      console.error("Error sending email", error);
      res.status(500).send("Error sending notification");
    }
  });

  // Inventory routes
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

  app.get("/api/audit-logs", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role === "user") {
      return res.status(401).send("Not authorized");
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    res.json(logs);
  });

  return httpServer;
}
