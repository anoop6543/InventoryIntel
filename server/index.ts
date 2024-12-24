import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { AddressInfo } from "net";

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

async function startServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const server = registerRoutes(app);

      // Global error handler
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        console.error('Server error:', err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });

      if (app.get("env") === "development") {
        setupVite(app, server)
          .then(() => {
            log("Vite middleware setup complete");
            server.on('error', (e: any) => {
              if (e.code === 'EADDRINUSE') {
                log(`Port ${port} is in use, trying next port`);
                server.close();
                startServer(port + 1).then(resolve).catch(reject);
              } else {
                reject(e);
              }
            });

            server.listen(port, "0.0.0.0", () => {
              const address = server.address() as AddressInfo;
              log(`Server started successfully on port ${address.port}`);
              resolve();
            });
          })
          .catch(reject);
      } else {
        serveStatic(app);
        log("Static file serving setup complete");

        server.on('error', (e: any) => {
          if (e.code === 'EADDRINUSE') {
            log(`Port ${port} is in use, trying next port`);
            server.close();
            startServer(port + 1).then(resolve).catch(reject);
          } else {
            reject(e);
          }
        });

        server.listen(port, "0.0.0.0", () => {
          const address = server.address() as AddressInfo;
          log(`Server started successfully on port ${address.port}`);
          resolve();
        });
      }
    } catch (error) {
      reject(error);
    }
  });
}

(async () => {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    log("Database connection established");

    // Start server with initial port 5000
    await startServer(5000);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();