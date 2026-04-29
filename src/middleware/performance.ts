/**
 * Performance Monitoring Middleware
 * 
 * Tracks request timing and logs slow operations for performance analysis.
 * 
 * Features:
 * - Request duration tracking (start to end)
 * - Slow request detection (configurable threshold)
 * - HTTP method, URL, status code, duration logging
 * - Production-ready logging format
 * - Configurable via environment variables
 * 
 * Environment Variables:
 * - PERF_SLOW_REQUEST_MS: Threshold for slow requests in ms (default: 1000)
 * - PERF_SLOW_QUERY_MS: Threshold for slow queries in ms (default: 100)
 * - PERF_LOG_ALL_REQUESTS: Log all requests regardless of speed (default: dev=true, prod=false)
 * 
 * Example output:
 *   [2026-04-29 10:15:23] GET /api/classes 200 45ms
 *   [SLOW REQUEST] POST /api/students 201 1250ms
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Performance monitoring configuration from environment variables
 */
const config = {
  slowRequestThreshold: parseInt(process.env.PERF_SLOW_REQUEST_MS || '1000', 10),
  slowQueryThreshold: parseInt(process.env.PERF_SLOW_QUERY_MS || '100', 10),
  logAllRequests: process.env.PERF_LOG_ALL_REQUESTS 
    ? process.env.PERF_LOG_ALL_REQUESTS === 'true'
    : process.env.NODE_ENV !== 'production',
};

/**
 * Export configuration for testing and debugging
 */
export const performanceConfig = config;

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
    if (duration >= config.slowRequestThreshold) {
      console.warn(
        `[SLOW REQUEST] ${timestamp} ${metrics.method} ${metrics.url} ${metrics.statusCode} ${duration}ms`
      );
    } else if (config.logAllRequests) {
      // Log normal requests if configured
      console.log(
        `[${timestamp}] ${metrics.method} ${metrics.url} ${metrics.statusCode} ${duration}ms`
      );
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
 * 
 * Or with custom threshold:
 *   const result = await monitorQuery(
 *     'complexReport',
 *     () => generateReport(),
 *     500 // custom 500ms threshold
 *   );
 */
export async function monitorQuery<T>(
  queryName: string,
  queryFn: () => T | Promise<T>,
  slowThreshold: number = config.slowQueryThreshold
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    if (duration >= slowThreshold) {
      console.warn(
        `[SLOW QUERY] ${formatTimestamp()} ${queryName} took ${duration}ms`
      );
    } else if (config.logAllRequests) {
      // Log all queries if configured (useful for development)
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
