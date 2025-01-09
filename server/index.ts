import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  log(`Error encountered: ${err.message}`);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

let currentServer: any = null;

// Cleanup function
async function cleanup() {
  if (currentServer) {
    return new Promise<void>((resolve) => {
      currentServer.close(() => {
        currentServer = null;
        resolve();
      });
    });
  }
}

// Handle process termination
process.on('SIGTERM', () => cleanup());
process.on('SIGINT', () => cleanup());

(async () => {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    log("Database connection established successfully");

    // Setup authentication
    setupAuth(app);
    log("Authentication setup completed");

    // Register routes and create HTTP server
    const server = registerRoutes(app);
    currentServer = server;

    // Setup Vite or static serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", async () => {
      log(`Server starting on port ${PORT}...`);

      try {
        const { cleanup: wsCleanup } = await setupWebSocket(server);
        server.once('close', wsCleanup);
        log(`Server and WebSocket setup complete on port ${PORT}`);
      } catch (error) {
        log(`WebSocket setup failed: ${error}`);
        await cleanup();
        process.exit(1);
      }
    });

    server.on('error', async (error: any) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${PORT} is already in use. Please stop any other processes using this port.`);
      } else {
        log(`Server error: ${error.message}`);
      }
      await cleanup();
      process.exit(1);
    });

  } catch (error) {
    log(`Fatal error during server initialization: ${error}`);
    await cleanup();
    process.exit(1);
  }
})();