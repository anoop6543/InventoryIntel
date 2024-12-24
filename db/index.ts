import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let _db: ReturnType<typeof drizzle>;

try {
  // Initialize the database connection with proper error handling
  _db = drizzle({
    connection: process.env.DATABASE_URL,
    schema,
    ws: ws,
  });

  // Test the connection immediately to ensure it's working
  const testConnection = async () => {
    try {
      await _db.execute(sql`SELECT 1`);
      console.log("Database connection established successfully");
    } catch (error) {
      console.error("Failed to connect to database:", error);
      throw error;
    }
  };

  // Run the test immediately
  testConnection();
} catch (error) {
  console.error("Failed to initialize database:", error);
  throw error;
}

// Export the database instance after initialization
export const db = _db;