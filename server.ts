import 'dotenv/config';
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import os from "os";
import apiRoutes from "./routes";
import { errorHandler } from "./src/lib/errorHandler";
import { performanceMonitor } from "./src/middleware/performance";
import { verifySocketAuth } from "./src/routes/middleware";
import { classService, teacherService } from "./services";

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
    // F-018: custom allowRequest checker. Validates the Origin header
    // against getAllowedOrigins() at handshake time (HTTP CORS only
    // covers regular requests; websocket handshakes need their own
    // check). Combined with the io.use(verifySocketAuth) middleware
    // below, an attacker must present BOTH a valid origin AND a
    // valid JWT cookie or token to establish a connection.
    allowRequest: (req, callback) => {
      try {
        const origin = req.headers.origin;
        const allowed = getAllowedOrigins();
        // No Origin header (server-to-server) is allowed; same-origin
        // requests may omit the header depending on the browser.
        if (!origin || allowed.includes(origin)) {
          return callback(null, true);
        }
        // Origin present but not in allow-list → reject
        return callback('Origin not allowed', false);
      } catch (err) {
        // Never crash the handshake on a config error; log and reject.
        console.error('[ws] allowRequest error:', err);
        return callback('Internal error', false);
      }
    },
    // Use path /ws to avoid conflicts with API routes
    path: '/ws/socket.io',
  });

  // F-001: Reject any Socket.IO handshake that lacks a valid auth_token cookie.
  // This mirrors the requireAuth middleware used by HTTP routes — same JWT
  // secret, same algorithm pinning (HS256), same server-side session check.
  io.use(async (socket, next) => {
    const auth = await verifySocketAuth(socket.handshake.headers);
    if (!auth) {
      const err = new Error('Authentication required');
      // @ts-expect-error attach data for client error surfacing (socket.io convention)
      err.data = { code: 'UNAUTHORIZED' };
      return next(err);
    }
    socket.data.teacherId = auth.teacherId;
    socket.data.sessionId = auth.sessionId;
    next();
  });

  // Class rooms — each classId is a separate Socket.io room.
  // On join_class, verify the authenticated teacher has access to the
  // requested class (global admin bypasses; otherwise must be a member
  // of class_teachers for that class). This prevents an authenticated
  // teacher from snooping another teacher's class updates.
  io.on('connection', (socket) => {
    socket.on('join_class', async (classId: string) => {
      const teacherId = socket.data.teacherId as string | undefined;
      if (!teacherId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }
      try {
        const isGlobalAdmin = await teacherService.getIsAdmin(teacherId);
        if (!isGlobalAdmin) {
          const access = await classService.isClassTeacher(classId, teacherId);
          if (!access) {
            socket.emit('error', { message: `Access denied for class ${classId}` });
            return;
          }
        }
        socket.join(classId);
      } catch (e) {
        console.warn('[socket] join_class error:', (e as Error).message);
        socket.emit('error', { message: 'Failed to join class' });
      }
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

  // F-009: JSON body size limit. Default 100kb is enough for bulk
  // attendance marking and student lists (largest realistic payload is
  // ~30 student records = ~3kb). Override via JSON_BODY_LIMIT env var.
  // Without this limit, an attacker can DoS by sending huge bodies.
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
  app.use(cookieParser());

  // Use separated API routes
  app.use("/api", apiRoutes);

  // Global error handler (must be after routes)
  app.use(errorHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

// F-017: open the error log as a write stream ONCE at module init.
// This replaces per-call fs.appendFileSync (which would block the
// event loop under an error storm) with buffered async writes.
// The stream is closed automatically on process exit by Node.js.
const errorLogPath = process.env.SERVER_ERROR_LOG || 'server-error.log';
const errorLogStream = fs.createWriteStream(errorLogPath, { flags: 'a' });
errorLogStream.on('error', (err) => {
  // Last-resort: if the stream itself errors, don't crash the process.
  console.error('[server-error.log] stream error:', err.message);
});

function logServerError(label: string, payload: unknown): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${label}\n${payload instanceof Error ? `${payload.message}\n${payload.stack ?? ''}` : String(payload)}\n\n`;
  errorLogStream.write(entry);
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  const timestamp = new Date().toISOString();
  console.error(`\n\x1b[31m[${timestamp}] UNCAUGHT EXCEPTION:\x1b[0m`, err.message);
  // F-017: async write via stream (no longer blocks event loop)
  logServerError('UNCAUGHT EXCEPTION', err);
});

process.on('unhandledRejection', (reason) => {
  const timestamp = new Date().toISOString();
  console.error(`\n\x1b[31m[${timestamp}] UNHANDLED REJECTION:\x1b[0m`, reason);
  // F-017: async write via stream (no longer blocks event loop)
  logServerError('UNHANDLED REJECTION', reason);
});

startServer();
