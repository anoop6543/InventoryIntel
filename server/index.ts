import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { AddressInfo } from "net";
import { setupAuth } from "./auth";

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

let currentServer: ReturnType<typeof registerRoutes> | null = null;

// Function to try different ports
async function startServer(initialPort: number, maxRetries: number = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const port = initialPort + attempt;
    try {
      if (currentServer) {
        await new Promise<void>((resolve) => {
          currentServer!.close(() => {
            log("Previous server instance closed");
            resolve();
          });
        });
      }

      currentServer = registerRoutes(app);

      await new Promise<void>((resolve, reject) => {
        currentServer!.listen(port, "0.0.0.0", () => {
          const address = currentServer?.address() as AddressInfo;
          log(`Server started successfully on port ${address.port}`);
          resolve();
        }).on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            log(`Port ${port} is in use, trying next port...`);
            reject(err);
          } else {
            log(`Failed to start server: ${err.message}`);
            reject(err);
          }
        });
      });

      return; // Server started successfully
    } catch (err) {
      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to start server after ${maxRetries} attempts`);
      }
      // Wait a bit before trying the next port
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

(async () => {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    log("Database connection established successfully");

    // Setup authentication
    setupAuth(app);
    log("Authentication setup completed");

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, currentServer!);
      log("Vite middleware setup complete");
    } else {
      serveStatic(app);
      log("Static file serving setup complete");
    }

    // Try to start the server with port 3000 as initial port
    await startServer(3000);

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received. Shutting down gracefully...');
  currentServer?.close(() => {
    log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('SIGINT received. Shutting down gracefully...');
  currentServer?.close(() => {
    log('Server closed');
    process.exit(0);
  });
});