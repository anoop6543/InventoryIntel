
import { db } from "./index";
import { items } from "./schema";

const categories = [
  "Raw Materials",
  "Tools", 
  "Safety Equipment",
  "Machinery Parts",
  "Electronics",
  "Packaging",
  "Chemicals",
  "Office Supplies",
];

const locations = [
  "Warehouse A",
  "Warehouse B", 
  "Production Floor",
  "Storage Room 1",
  "Storage Room 2",
  "Hazmat Storage",
  "Tool Shop",
];

function generateSKU(category: string, index: number) {
  return `${category.substring(0, 3).toUpperCase()}-${String(index).padStart(4, "0")}`;
}

function generateItems() {
  const itemsToInsert = [];
  let index = 0;

  // Raw Materials with low stock
  const rawMaterials = ["Steel Sheet", "Aluminum Rod", "Copper Wire"];
  for (let i = 0; i < 20; i++) {
    const name = `${rawMaterials[i % rawMaterials.length]} Type ${Math.floor(i / rawMaterials.length) + 1}`;
    const minQuantity = 50;
    const quantity = i < 10 ? Math.floor(Math.random() * 20) + 1 : Math.floor(Math.random() * 1000) + 100; // First 10 items will have low stock
    itemsToInsert.push({
      name,
      sku: generateSKU("RAW", index++),
      category: "Raw Materials",
      quantity,
      minQuantity,
      unitPrice: (Math.random() * 500 + 50).toFixed(2),
      location: locations[Math.floor(Math.random() * locations.length)],
      description: `Industrial grade ${name.toLowerCase()} for manufacturing use`,
    });
  }

  // Tools with some low stock
  const tools = ["Wrench Set", "Power Drill", "Safety Gloves"];
  for (let i = 0; i < 15; i++) {
    const name = `${tools[i % tools.length]} Model ${Math.floor(i / tools.length) + 1}`;
    const minQuantity = 10;
    const quantity = i < 5 ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 200) + 20; // First 5 tools will have low stock
    itemsToInsert.push({
      name,
      sku: generateSKU("TOOL", index++),
      category: "Tools",
      quantity,
      minQuantity,
      unitPrice: (Math.random() * 300 + 20).toFixed(2),
      location: locations[Math.floor(Math.random() * locations.length)],
      description: `Professional grade ${name.toLowerCase()}`,
    });
  }

  return itemsToInsert;
}

async function seed() {
  try {
    console.log("Starting to seed database...");
    const itemsToInsert = generateItems();
    await db.delete(items);
    await db.insert(items).values(itemsToInsert);
    console.log("Successfully seeded database with low stock items");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
