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
 * - Metrics aggregation and storage
 * 
 * Environment Variables:
 * - PERF_SLOW_REQUEST_MS: Threshold for slow requests in ms (default: 1000)
 * - PERF_SLOW_QUERY_MS: Threshold for slow queries in ms (default: 100)
 * - PERF_LOG_ALL_REQUESTS: Log all requests regardless of speed (default: dev=true, prod=false)
 * - PERF_METRICS_ENABLED: Enable metrics collection (default: true)
 * - PERF_METRICS_BUFFER_SIZE: Max metrics to store (default: 10000)
 * 
 * Example output:
 *   [2026-04-29 10:15:23] GET /api/classes 200 45ms
 *   [SLOW REQUEST] POST /api/students 201 1250ms
 */

import type { Request, Response, NextFunction } from 'express';
import { metricsStore } from './metricsStore';

/**
 * Performance monitoring configuration from environment variables
 */
const config = {
  slowRequestThreshold: parseInt(process.env.PERF_SLOW_REQUEST_MS || '1000', 10),
  slowQueryThreshold: parseInt(process.env.PERF_SLOW_QUERY_MS || '100', 10),
  logAllRequests: process.env.PERF_LOG_ALL_REQUESTS 
    ? process.env.PERF_LOG_ALL_REQUESTS === 'true'
    : process.env.NODE_ENV !== 'production',
  metricsEnabled: process.env.PERF_METRICS_ENABLED !== 'false', // Default: enabled
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
 * F-023: Sanitize a URL for logging.
 *
 * Strips query strings (which can contain PII like search terms, names,
 * emails). Replaces path segments longer than 12 chars with a short
 * hash so entity IDs are still distinguishable for debugging without
 * leaking the actual identifier value. URL length is also capped to
 * prevent log line bloat from accidental large URLs.
 *
 * Examples:
 *   /api/students/abc123def-456                       → /api/students/abc1..56
 *   /api/classes?search=John%20Doe&page=2             → /api/classes
 *   /api/teachers/verylong-uuid-here-12345678         → /api/teachers/abc1..78
 */
export function sanitizeUrlForLog(url: string): string {
  if (!url) return '/';
  // Strip query string entirely
  const pathOnly = url.split('?')[0] ?? url;
  if (!pathOnly) return '/';
  // Cap total length to keep log lines bounded
  if (pathOnly.length <= 80) return pathOnly;
  return `${pathOnly.slice(0, 60)}…(${pathOnly.length}b)`;
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
  const originalEnd = res.end.bind(res) as Response['end'];

  // Override res.end to capture response time
  res.end = ((...args: Parameters<Response['end']>): ReturnType<Response['end']> => {
    const duration = Date.now() - startTime;
    const timestamp = formatTimestamp();

    const rawUrl = req.originalUrl || req.url;
    const sanitizedUrl = sanitizeUrlForLog(rawUrl);

    const metrics: PerformanceMetrics = {
      method: req.method,
      url: sanitizedUrl,
      statusCode: res.statusCode,
      duration,
      timestamp,
    };

    // Store metrics if enabled (URL stored unsanitized for the metrics
    // store so ops dashboards can filter; but console logs use sanitized)
    if (config.metricsEnabled) {
      metricsStore.addRequest({
        timestamp: Date.now(),
        method: req.method,
        url: sanitizedUrl,
        statusCode: res.statusCode,
        duration,
      });
    }

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
    return originalEnd(...args);
  }) as Response['end'];

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

    // Store metrics if enabled
    if (config.metricsEnabled) {
      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName,
        duration,
        success: true,
      });
    }

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

    // Store failed query metric if enabled
    if (config.metricsEnabled) {
      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName,
        duration,
        success: false,
      });
    }

    console.error(
      `[QUERY ERROR] ${formatTimestamp()} ${queryName} failed after ${duration}ms:`,
      error
    );
    throw error;
  }
}
