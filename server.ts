import 'dotenv/config';
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import apiRoutes from "./routes";

// Simple request logger middleware
function requestLogger() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();
    const method = req.method;
    const url = req.url;
    
    // Capture original end to log after response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const timestamp = new Date().toISOString();
      const logLine = `${timestamp} ${method} ${url} ${status} ${duration}ms`;
      
      // Color-coded console output
      const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
      const reset = '\x1b[0m';
      console.log(`  ${method.padEnd(6)} ${url.padEnd(45)} ${statusColor}${status}${reset} ${duration}ms`);
      
      // Log errors to file
      if (status >= 500) {
        const logEntry = `${timestamp} ERROR ${method} ${url} ${status} ${duration}ms\n`;
        fs.appendFileSync('server-error.log', logEntry);
      }
      
      originalEnd.apply(res, args);
    } as any;
    
    next();
  };
}

async function startServer() {
  const args = process.argv.slice(2);
  const isNetwork = args.includes('--network');
  const HOST = isNetwork ? '0.0.0.0' : '127.0.0.1';
  
  const app = express();
  const PORT = 3000;

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Gzip compression for faster network transfer
  app.use(compression());

  // Request logging
  app.use(requestLogger());

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Use separated API routes
  app.use("/api", apiRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // In network mode, allow Vite to accept requests from LAN IPs
        host: isNetwork ? '0.0.0.0' : '127.0.0.1',
        allowedHosts: isNetwork ? true : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    // SPA fallback: serve index.html for all non-API routes so client-side routing works
    app.get('*', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n========================================`);
    console.log(` Teacher Assistant Server Started`);
    console.log(`========================================`);
    if (isNetwork) {
      console.log(`\n 🌍 INTERNAL-SITE MODE ACTIVE`);
      console.log(` -> Local:   http://localhost:${PORT}`);
      console.log(` -> Network: http://<YOUR_IP_ADDRESS>:${PORT}`);
      console.log(`\n (To find your IP, open cmd and type 'ipconfig')`);
    } else {
      console.log(`\n 🔒 LOCAL MODE ACTIVE`);
      console.log(` -> Local:   http://127.0.0.1:${PORT}`);
      console.log(`\n (Only this computer can access the app.)`);
      console.log(` (Run with 'npm run dev:network' to share on Wi-Fi)`);
    }
    console.log(`========================================\n`);
    console.log('  METHOD   URL                                           STATUS DURATION');
    console.log('  ──────────────────────────────────────────────────────────────────────');
  });
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  const timestamp = new Date().toISOString();
  console.error(`\n\x1b[31m[${timestamp}] UNCAUGHT EXCEPTION:\x1b[0m`, err.message);
  fs.appendFileSync('server-error.log', `${timestamp} UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}\n\n`);
});

process.on('unhandledRejection', (reason) => {
  const timestamp = new Date().toISOString();
  console.error(`\n\x1b[31m[${timestamp}] UNHANDLED REJECTION:\x1b[0m`, reason);
  fs.appendFileSync('server-error.log', `${timestamp} UNHANDLED REJECTION: ${reason}\n\n`);
});

startServer();
