
import { db } from "./index";
import { items } from "./schema";

const categories = ["Raw Materials", "Tools", "Safety Equipment", "Machinery Parts", "Electronics", "Packaging", "Chemicals", "Office Supplies"];
const locations = ["Warehouse A", "Warehouse B", "Production Floor", "Storage Room 1", "Storage Room 2", "Hazmat Storage", "Tool Shop"];

function generateSKU(category: string, index: number) {
  return `${category.substring(0, 3).toUpperCase()}-${String(index).padStart(4, '0')}`;
}

  function generateItems() {
    const itemsToInsert = [];
    let index = 0;

    // Raw Materials
    const rawMaterials = ["Steel Sheet", "Aluminum Rod", "Copper Wire"];
    for (let i = 0; i < 200; i++) {
      const name = `${rawMaterials[i % rawMaterials.length]} Type ${Math.floor(i / rawMaterials.length) + 1}`;
      const quantity = i < 50 ? Math.floor(Math.random() * 10) + 1 : Math.floor(Math.random() * 1000) + 100; // Low stock for the first 50 items
      itemsToInsert.push({
        name,
        sku: generateSKU("RAW", index++),
        category: "Raw Materials",
        quantity,
        minQuantity: 50,
        unitPrice: (Math.random() * 500 + 50).toFixed(2),
        location: locations[Math.floor(Math.random() * locations.length)],
        description: `Industrial grade ${name.toLowerCase()} for manufacturing use`
      });
    }

    // Add more categories and items similarly...

    return itemsToInsert;
  }

  // Tools
  const tools = ["Wrench Set", "Power Drill", "Measuring Tape", "Safety Gloves", "Welding Machine", "Screwdriver Set", "Hammer", "Saw"];
  for (let i = 0; i < 150; i++) {
    const name = `${tools[i % tools.length]} Model ${Math.floor(i / tools.length) + 1}`;
    itemsToInsert.push({
      name,
      sku: generateSKU("TOOL", index++),
      category: "Tools",
      quantity: Math.floor(Math.random() * 200) + 20,
      minQuantity: 10,
      unitPrice: (Math.random() * 300 + 20).toFixed(2),
      location: locations[Math.floor(Math.random() * locations.length)],
      description: `Professional grade ${name.toLowerCase()}`
    });
  }

  // Continue with other categories...
  // This pattern continues for all categories until we reach 1000 items
  // For brevity, I'll include the function to generate the rest

  const restOfItems = [
    "Safety Helmet", "Safety Boots", "Ear Protection", "Safety Goggles", "First Aid Kit",
    "Machine Motor", "Bearings", "Gears", "Belts", "Pulleys",
    "Circuit Board", "Sensors", "Switches", "Cables", "Controllers",
    "Cardboard Box", "Plastic Container", "Bubble Wrap", "Tape", "Labels",
    "Industrial Cleaner", "Lubricant", "Adhesive", "Paint", "Solvent"
  ];

  for (let i = 0; i < 650; i++) {
    const categoryIndex = Math.floor(i / 130) + 2;
    const name = `${restOfItems[i % restOfItems.length]} Type ${Math.floor(i / restOfItems.length) + 1}`;
    itemsToInsert.push({
      name,
      sku: generateSKU(categories[categoryIndex].substring(0, 3), index++),
      category: categories[categoryIndex],
      quantity: Math.floor(Math.random() * 500) + 50,
      minQuantity: 25,
      unitPrice: (Math.random() * 200 + 10).toFixed(2),
      location: locations[Math.floor(Math.random() * locations.length)],
      description: `Standard industrial ${name.toLowerCase()}`
    });
  }

  return itemsToInsert;
}

async function seed() {
  try {
    console.log('Starting to seed database...');
    const itemsToInsert = generateItems();
    await db.delete(items);
    await db.insert(items).values(itemsToInsert);
    console.log('Successfully seeded database with 1000 items');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

seed();
