import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { db } from "@db";
import { items, auditLogs, suppliers } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import type { Item } from "@db/schema";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  app.post("/api/notify-supplier", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(401).send("Not authorized");
    }

    const lowStockItems = req.body as Item[];
    const isDebug = process.env.NODE_ENV !== 'production';

    if (isDebug) {
      console.log('Debug mode: Email would be sent for items:', lowStockItems);
      console.log('Debug mode: CC notification to:', 'anoop6543@gmail.com');
      return res.status(200).send("Debug mode: Notification simulated successfully");
    }

    // Get relevant suppliers
    const itemCategories = Array.from(new Set(lowStockItems.map(item => item.category)));
    const relevantSuppliers = await db.select().from(suppliers)
      .where(sql`category = ANY(${itemCategories})`);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || "inventory@company.com",
        pass: process.env.EMAIL_PASSWORD || "your-password",
      },
    });

    const itemsList = lowStockItems
      .map((item: Item) => `
        • ${item.name}
          SKU: ${item.sku}
          Current Stock: ${item.quantity}
          Minimum Required: ${item.minQuantity}
          Required Quantity: ${item.minQuantity * 2 - item.quantity}
      `).join("\n");

    const mailOptions = {
      from: '"Inventory Management System" <inventory@company.com>',
      to: relevantSuppliers.map(s => s.email).join(','),
      cc: ['procurement@company.com', 'anoop6543@gmail.com'],
      subject: 'Urgent: Stock Replenishment Required',
      text: `Dear Supplier,

We are writing to request an urgent replenishment of the following items that have fallen below our minimum stock requirements:

${itemsList}

Please provide a quote and estimated delivery timeline for the above items at your earliest convenience.

Delivery Address:
Company Name
123 Business Street
Industrial District
City, State 12345

Best regards,
Inventory Management Team
Company Name
Phone: (555) 123-4567
`,
      html: `<p>Dear Supplier,</p>
<p>We are writing to request an urgent replenishment of the following items that have fallen below our minimum stock requirements:</p>
<div style="margin: 20px 0; padding: 10px; background: #f5f5f5;">
${lowStockItems.map((item: Item) => `
  <div style="margin-bottom: 15px;">
    <strong>${item.name}</strong><br>
    SKU: ${item.sku}<br>
    Current Stock: ${item.quantity}<br>
    Minimum Required: ${item.minQuantity}<br>
    Required Quantity: ${item.minQuantity * 2 - item.quantity}
  </div>
`).join('')}
</div>
<p>Please provide a quote and estimated delivery timeline for the above items at your earliest convenience.</p>
<p><strong>Delivery Address:</strong><br>
Company Name<br>
123 Business Street<br>
Industrial District<br>
City, State 12345</p>
<p>Best regards,<br>
Inventory Management Team<br>
Company Name<br>
Phone: (555) 123-4567</p>`
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).send("Notification sent successfully");
    } catch (error) {
      console.error("Error sending email", error);
      res.status(500).send("Error sending notification");
    }
  });

  // Additional inventory management routes
  app.get("/api/items/low-stock", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authorized");
    }

    const lowStockItems = await db.select()
      .from(items)
      .where(sql`quantity <= min_quantity`);

    res.json(lowStockItems);
  });

  // Existing inventory routes
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