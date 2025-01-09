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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Cleanup function to handle server shutdown
async function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    log("Starting cleanup process...");

    // Kill any existing processes on port 5000
    try {
      const { stdout } = await execAsync("lsof -t -i:5000");
      if (stdout) {
        const pids = stdout.split('\n').filter(Boolean);
        for (const pid of pids) {
          if (pid !== process.pid.toString()) {
            await execAsync(`kill -9 ${pid}`);
          }
        }
      }
    } catch (error) {
      // Ignore error if no processes found
    }

    if (wsServer) {
      log("Cleaning up WebSocket server...");
      const wsCleanup = wsServer.cleanup;
      wsServer = null;
      await wsCleanup();
    }

    if (server) {
      log("Closing HTTP server...");
      await new Promise<void>((resolve, reject) => {
        server.close((err: Error) => {
          if (err) {
            log(`Error closing server: ${err.message}`);
            reject(err);
          } else {
            log("Server closed successfully");
            resolve();
          }
        });
        // Force close after timeout
        setTimeout(() => {
          server.emit('close');
          resolve();
        }, 5000);
      });
      server = null;
    }

    isShuttingDown = false;
    log("Cleanup completed");
  } catch (error) {
    log(`Error during cleanup: ${error}`);
    isShuttingDown = false;
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  log(`Error encountered: ${err.message}`);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
  throw err;
});

(async () => {
  try {
    // Ensure no existing server is running
    await cleanup();

    // Test database connection
    await db.execute(sql`SELECT 1`);
    log("Database connection established successfully");

    // Setup authentication
    setupAuth(app);
    log("Authentication setup completed");

    // Register routes and create HTTP server
    server = registerRoutes(app);
    log("Routes registered successfully");

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
        const ws = await setupWebSocket(server);
        wsServer = ws;
        log(`Server and WebSocket setup complete on port ${PORT}`);
      } catch (error) {
        log(`WebSocket setup failed: ${error}`);
        await cleanup();
        process.exit(1);
      }
    });

    server.on('error', async (error: any) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${PORT} is already in use. Attempting cleanup and retry...`);
        await cleanup();
        process.exit(1);
      } else {
        log(`Server error: ${error.message}`);
        await cleanup();
        process.exit(1);
      }
    });

  } catch (error) {
    log(`Fatal error during server initialization: ${error}`);
    await cleanup();
    process.exit(1);
  }
})();