import 'dotenv/config';
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import apiRoutes from "./routes";
import { errorHandler } from "./src/lib/errorHandler";

// Auto-detect and configure database
async function configureDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const DB_TYPE = process.env.DB_TYPE;
  
  // If explicitly set to sqlite, use SQLite
  if (DB_TYPE === 'sqlite') {
    console.log('[db] Using SQLite (DB_TYPE=sqlite)');
    return;
  }
  
  // If DATABASE_URL is set, try PostgreSQL
  if (DATABASE_URL) {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
      const result = await pool.query('SELECT 1');
      await pool.end();
      
      process.env.DB_TYPE = 'postgres';
      console.log('[db] PostgreSQL connected successfully - using PostgreSQL');
      return;
    } catch (err) {
      console.warn('[db] PostgreSQL connection failed, falling back to SQLite:', (err as Error).message);
      process.env.DB_TYPE = 'sqlite';
      return;
    }
  }
  
  // Default to SQLite
  console.log('[db] Using SQLite (no DATABASE_URL set)');
}

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
      
      // Only log errors to console (non-debug mode)
      if (status >= 400) {
        const statusColor = status >= 500 ? '\x1b[31m' : '\x1b[33m';
        const reset = '\x1b[0m';
        console.error(`  ${statusColor}${status}${reset} ${method} ${url} ${duration}ms`);
      }
      
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
  
  // Configure database (auto-detect PostgreSQL)
  await configureDatabase();
  
  const app = express();
  const PORT = 3000;

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind requires unsafe-inline
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    } : false, // Disabled in dev because Vite injects inline scripts
    crossOriginEmbedderPolicy: false,
  }));

  // Gzip compression for faster network transfer
  app.use(compression());

  // Request logging
  app.use(requestLogger());

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Use separated API routes
  app.use("/api", apiRoutes);

  // Global error handler (must be after routes)
  app.use(errorHandler);

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
