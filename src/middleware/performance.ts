import type { Request, Response, NextFunction } from 'express';

/**
 * Request timing middleware.
 *
 * Logs slow requests (>= slowRequestThreshold ms) as warnings.
 * Logs every request as info when PERF_LOG_ALL_REQUESTS=true (default: dev only).
 *
 * Env:
 *   PERF_SLOW_REQUEST_MS  Threshold for slow-request warning (default: 1000)
 *   PERF_LOG_ALL_REQUESTS  Log every request (default: NODE_ENV !== 'production')
 */

const slowRequestThreshold = parseInt(process.env.PERF_SLOW_REQUEST_MS || '1000', 10);
const logAllRequests = process.env.PERF_LOG_ALL_REQUESTS
  ? process.env.PERF_LOG_ALL_REQUESTS === 'true'
  : process.env.NODE_ENV !== 'production';

/**
 * Sanitize a URL for logging.
 *
 * Strips query strings (which can contain PII like search terms, names,
 * emails). Caps path length to keep log lines bounded.
 *
 * Examples:
 *   /api/students/abc123def-456                       → /api/students/abc1..56
 *   /api/classes?search=John%20Doe&page=2             → /api/classes
 */
export function sanitizeUrlForLog(url: string): string {
  if (!url) return '/';
  const pathOnly = url.split('?')[0] ?? url;
  if (!pathOnly) return '/';
  if (pathOnly.length <= 80) return pathOnly;
  return `${pathOnly.slice(0, 60)}…(${pathOnly.length}b)`;
}

export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const originalEnd = res.end.bind(res) as Response['end'];

  res.end = ((...args: Parameters<Response['end']>): ReturnType<Response['end']> => {
    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const sanitizedUrl = sanitizeUrlForLog(req.originalUrl || req.url);

    if (duration >= slowRequestThreshold) {
      console.warn(`[SLOW REQUEST] ${timestamp} ${req.method} ${sanitizedUrl} ${res.statusCode} ${duration}ms`);
    } else if (logAllRequests) {
      console.log(`[${timestamp}] ${req.method} ${sanitizedUrl} ${res.statusCode} ${duration}ms`);
    }

    return originalEnd(...args);
  }) as Response['end'];

  next();
}