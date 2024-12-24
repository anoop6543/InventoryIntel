import { db } from "@db";
import { 
  items, 
  suppliers, 
  purchaseOrders, 
  purchaseOrderItems,
  type Item,
  type Supplier 
} from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { log } from "../vite";

interface ReorderCalculation {
  itemId: number;
  supplierId: number;
  quantity: number;
  estimatedCost: number;
}

export class InventoryAutomationService {
  // Check items that need reordering based on current quantity and reorder point
  async checkReorderNeeds(): Promise<ReorderCalculation[]> {
    const itemsToReorder = await db.select()
      .from(items)
      .where(
        and(
          sql`${items.quantity} <= ${items.reorderPoint}`,
          sql`${items.reorderPoint} > 0`
        )
      );

    const reorderCalculations: ReorderCalculation[] = [];

    for (const item of itemsToReorder) {
      // Find suitable supplier
      const [supplier] = await db.select()
        .from(suppliers)
        .where(eq(suppliers.category, item.category))
        .orderBy(sql`reliability_score DESC`)
        .limit(1);

      if (supplier) {
        reorderCalculations.push({
          itemId: item.id,
          supplierId: supplier.id,
          quantity: item.reorderQuantity,
          estimatedCost: Number(item.unitPrice) * item.reorderQuantity
        });
      }
    }

    return reorderCalculations;
  }

  // Create purchase orders for items that need reordering
  async createAutomatedPurchaseOrders(calculations: ReorderCalculation[]): Promise<void> {
    // Group items by supplier
    const supplierOrders = new Map<number, ReorderCalculation[]>();

    calculations.forEach(calc => {
      const existing = supplierOrders.get(calc.supplierId) || [];
      supplierOrders.set(calc.supplierId, [...existing, calc]);
    });

    // Create purchase orders for each supplier
    for (const [supplierId, items] of [...supplierOrders.entries()]) {
      const totalAmount = items.reduce((sum: number, item: ReorderCalculation) => sum + item.estimatedCost, 0);

      // Create purchase order
      const [purchaseOrder] = await db.insert(purchaseOrders)
        .values({
          supplierId,
          totalAmount,
          status: 'pending',
          isAutomated: true,
          metadata: {
            automationNotes: 'Created by automated reordering system',
            reorderTrigger: 'quantity_below_threshold'
          }
        })
        .returning();

      // Create purchase order items
      await db.insert(purchaseOrderItems)
        .values(items.map((item: ReorderCalculation) => ({
          purchaseOrderId: purchaseOrder.id,
          itemId: item.itemId,
          quantity: item.quantity,
          unitPrice: item.estimatedCost / item.quantity,
          subtotal: item.estimatedCost
        })));

      log(`Created automated purchase order ${purchaseOrder.id} for supplier ${supplierId}`);
    }
  }

  // Main method to run the automation check
  async runAutomationCheck(): Promise<void> {
    try {
      const reorderNeeds = await this.checkReorderNeeds();
      if (reorderNeeds.length > 0) {
        await this.createAutomatedPurchaseOrders(reorderNeeds);
        log(`Created ${reorderNeeds.length} automated reorder calculations`);
      }
    } catch (error) {
      log(`Error in automation check: ${error}`);
      throw error;
    }
  }
}

export const automationService = new InventoryAutomationService();