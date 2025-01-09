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

// Cleanup function to terminate server and connections
function cleanup() {
  process.exit(0);
}

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

let server: any = null;

(async () => {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    log("Database connection established successfully");

    // Setup authentication
    setupAuth(app);
    log("Authentication setup completed");

    // Register routes and create HTTP server
    server = registerRoutes(app);

    // Setup Vite or static serving
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Function to try different ports
    const startServer = async (port: number, maxRetries = 3): Promise<void> => {
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', (err: any) => {
            if (err.code === 'EADDRINUSE' && port < (5000 + maxRetries)) {
              log(`Port ${port} is in use, trying ${port + 1}`);
              startServer(port + 1, maxRetries).then(resolve).catch(reject);
            } else {
              reject(err);
            }
          });

          server.once('listening', async () => {
            log(`Server started on port ${port}`);
            try {
              const { cleanup: wsCleanup } = await setupWebSocket(server);
              server.once('close', wsCleanup);
              resolve();
            } catch (error) {
              log(`WebSocket setup failed: ${error}`);
              reject(error);
            }
          });

          server.listen(port, "0.0.0.0");
        });
      } catch (error) {
        if (port >= (5000 + maxRetries)) {
          throw new Error(`Unable to find available port after ${maxRetries} retries`);
        }
        throw error;
      }
    };

    await startServer(5000);
  } catch (error) {
    log(`Fatal error during server initialization: ${error}`);
    if (server) {
      server.close();
    }
    process.exit(1);
  }
})();