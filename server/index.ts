import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure logging
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

let server: any = null;
let wsServer: any = null;
let isShuttingDown = false;

async function cleanup(exit = false) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    log("Starting cleanup process...");

    // Cleanup existing port
    try {
      const { stdout } = await execAsync("lsof -t -i:5000");
      if (stdout) {
        const pids = stdout.split('\n').filter(Boolean);
        for (const pid of pids) {
          if (pid !== process.pid.toString()) {
            try {
              await execAsync(`kill -9 ${pid}`);
              log(`Killed process ${pid}`);
            } catch (error) {
              // Ignore errors when killing processes
            }
          }
        }
      }
    } catch (error) {
      // Ignore error if no processes found
    }

    // Cleanup WebSocket server
    if (wsServer) {
      log("Cleaning up WebSocket server...");
      try {
        const wsCleanup = wsServer.cleanup;
        wsServer = null;
        await wsCleanup();
      } catch (error) {
        log(`Error cleaning up WebSocket server: ${error}`);
      }
    }

    // Cleanup HTTP server
    if (server) {
      log("Closing HTTP server...");
      await new Promise<void>((resolve) => {
        try {
          server.close(() => {
            log("Server closed successfully");
            resolve();
          });
        } catch (error) {
          log(`Error closing server: ${error}`);
          resolve();
        }
        // Force resolve after timeout
        setTimeout(resolve, 1000);
      });
      server = null;
    }

    isShuttingDown = false;
    log("Cleanup completed");

    if (exit) {
      process.exit(0);
    }
  } catch (error) {
    log(`Error during cleanup: ${error}`);
    isShuttingDown = false;
    if (exit) {
      process.exit(1);
    }
  }
}

// Handle process termination
process.on('SIGTERM', () => cleanup(true));
process.on('SIGINT', () => cleanup(true));

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  log(`Error encountered: ${err.message}`);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

async function startServer() {
  try {
    // Ensure cleanup
    await cleanup();
    log("Initial cleanup completed");

    // Add delay after cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test database connection
    await db.execute(sql`SELECT 1`);
    log("Database connection established");

    // Setup authentication after database is confirmed
    setupAuth(app);
    log("Authentication setup completed");

    // Register routes and create HTTP server
    server = registerRoutes(app);
    log("Routes registered");

    // Setup Vite or static serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
      log("Vite setup completed");
    } else {
      serveStatic(app);
      log("Static serving setup completed");
    }

    // Start server
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", async () => {
      log(`Server starting on port ${PORT}`);

      try {
        // Setup WebSocket after server is listening
        const ws = await setupWebSocket(server);
        wsServer = ws;
        log(`Server and WebSocket setup complete on port ${PORT}`);
      } catch (error) {
        log(`WebSocket setup failed: ${error}`);
        await cleanup(true);
      }
    });

    server.on('error', async (error: any) => {
      log(`Server error: ${error.message}`);
      if (error.code === 'EADDRINUSE') {
        log(`Port ${PORT} is already in use. Attempting cleanup and retry...`);
        await cleanup(true);
      }
    });

  } catch (error) {
    log(`Fatal error during server initialization: ${error}`);
    await cleanup(true);
  }
}

// Start the server
startServer();