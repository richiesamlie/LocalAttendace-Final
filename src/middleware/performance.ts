/**
 * Performance Monitoring Middleware
 * 
 * Tracks request timing and logs slow operations for performance analysis.
 * 
 * Features:
 * - Request duration tracking (start to end)
 * - Slow request detection (>1000ms threshold)
 * - HTTP method, URL, status code, duration logging
 * - Production-ready logging format
 * 
 * Example output:
 *   [2026-04-29 10:15:23] GET /api/classes 200 45ms
 *   [SLOW REQUEST] POST /api/students 201 1250ms
 */

import type { Request, Response, NextFunction } from 'express';

const SLOW_REQUEST_THRESHOLD = 1000; // milliseconds

export interface PerformanceMetrics {
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  timestamp: string;
}

/**
 * Format timestamp for logging
 */
function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Performance monitoring middleware
 * Tracks request timing and logs slow requests
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Capture the original end function
  const originalEnd = res.end.bind(res);

  // Override res.end to capture response time
  res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
    const duration = Date.now() - startTime;
    const timestamp = formatTimestamp();

    const metrics: PerformanceMetrics = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      timestamp,
    };

    // Log slow requests with warning
    if (duration >= SLOW_REQUEST_THRESHOLD) {
      console.warn(
        `[SLOW REQUEST] ${timestamp} ${metrics.method} ${metrics.url} ${metrics.statusCode} ${duration}ms`
      );
    } else {
      // Log normal requests in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[${timestamp}] ${metrics.method} ${metrics.url} ${metrics.statusCode} ${duration}ms`
        );
      }
    }

    // Call the original end function
    return originalEnd(chunk, encoding, callback);
  } as any;

  next();
}

/**
 * Query timing wrapper for monitoring slow database operations
 * 
 * Usage:
 *   const result = await monitorQuery(
 *     'getStudentsByClass',
 *     () => db.stmt.getStudentsByClass.all(classId)
 *   );
 */
export async function monitorQuery<T>(
  queryName: string,
  queryFn: () => T | Promise<T>,
  slowThreshold: number = 100 // milliseconds
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    if (duration >= slowThreshold) {
      console.warn(
        `[SLOW QUERY] ${formatTimestamp()} ${queryName} took ${duration}ms`
      );
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[QUERY] ${formatTimestamp()} ${queryName} completed in ${duration}ms`
      );
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[QUERY ERROR] ${formatTimestamp()} ${queryName} failed after ${duration}ms:`,
      error
    );
    throw error;
  }
}
