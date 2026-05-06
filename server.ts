import 'dotenv/config';
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import os from "os";
import apiRoutes from "./routes";
import { errorHandler } from "./src/lib/errorHandler";
import { performanceMonitor } from "./src/middleware/performance";

// Singleton Socket.io instance — exported so routes.ts can emit events
export let io: SocketIOServer;

// Get allowed origins from environment or default to localhost
const getAllowedOrigins = () => {
  const origins = process.env.ALLOWED_ORIGINS;
  if (origins) {
    return origins.split(',').map(o => o.trim());
  }
  // Default: allow localhost in all forms
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
};

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
      await pool.query('SELECT 1');
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

async function startServer() {
  const args = process.argv.slice(2);
  const isNetwork = args.includes('--network');
  const HOST = isNetwork ? '0.0.0.0' : '127.0.0.1';
  
  // Configure database (auto-detect PostgreSQL)
  await configureDatabase();
  
  const app = express();
  const httpServer = createHttpServer(app);
  const PORT = 3000;

  // Initialise Socket.io on the same HTTP server
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
    // Use path /ws to avoid conflicts with API routes
    path: '/ws/socket.io',
  });

  // Class rooms — each classId is a separate Socket.io room
  io.on('connection', (socket) => {
    // Client joins the room for the class they are currently viewing
    socket.on('join_class', (classId: string) => {
      socket.join(classId);
    });
    // Client leaves the room when switching to another class
    socket.on('leave_class', (classId: string) => {
      socket.leave(classId);
    });
  });

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

  // Performance monitoring and request logging
  app.use(performanceMonitor);

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

  httpServer.listen(PORT, HOST, () => {
    console.log(`\n========================================`);
    console.log(` Teacher Assistant Server Started`);
    console.log(`========================================`);
    if (isNetwork) {
      const interfaces = os.networkInterfaces();
      const ipList: string[] = [];
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === 'IPv4' && !iface.internal) {
            ipList.push(`http://${iface.address}:${PORT} (${name})`);
          }
        }
      }
      console.log(`\n 🌍 INTERNAL-SITE MODE ACTIVE`);
      console.log(` -> Local:   http://localhost:${PORT}`);
      if (ipList.length > 0) {
        console.log(` -> Network Interfaces:`);
        ipList.forEach(ip => console.log(`      - ${ip}`));
      } else {
        console.log(` -> Network: http://<YOUR_IP_ADDRESS>:${PORT}`);
      }
      console.log(`\n (You can also type 'ipconfig' in cmd to verify your IP)`);
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
