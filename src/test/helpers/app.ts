import express from 'express';
import cookieParser from 'cookie-parser';
import routes from '../../../routes';

/**
 * Create Express app instance for testing
 * Mimics the setup in server.ts but without Socket.io and Vite middleware
 * 
 * Note: Rate limiting is configured in middleware but uses in-memory store,
 * so each test app instance has its own rate limit counters.
 */
export function createTestApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // API routes
  app.use('/api', routes);

  return app;
}
