/**
 * Performance Metrics Store
 * 
 * In-memory circular buffer for storing performance metrics.
 * Automatically rotates old data to prevent memory overflow.
 * 
 * Features:
 * - Circular buffer with configurable size
 * - Request metrics aggregation
 * - Query metrics aggregation  
 * - Percentile calculations (p50, p95, p99)
 * - Time-windowed queries
 */

export interface RequestMetric {
  timestamp: number;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
}

export interface QueryMetric {
  timestamp: number;
  queryName: string;
  duration: number;
  success: boolean;
}

export interface AggregatedMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    p50: number;
    p95: number;
    p99: number;
    slowest: RequestMetric[];
    byMethod: Record<string, number>;
    byEndpoint: Record<string, { count: number; avgDuration: number }>;
  };
  queries: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    p50: number;
    p95: number;
    p99: number;
    slowest: QueryMetric[];
    byName: Record<string, { count: number; avgDuration: number }>;
  };
  timeRange: {
    start: number;
    end: number;
    durationMs: number;
  };
}

class MetricsStore {
  private maxSize: number;
  private requestMetrics: RequestMetric[] = [];
  private queryMetrics: QueryMetric[] = [];
  private startTime: number = Date.now();

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Add a request metric
   */
  addRequest(metric: RequestMetric): void {
    this.requestMetrics.push(metric);
    
    // Rotate if over limit (keep newest)
    if (this.requestMetrics.length > this.maxSize) {
      this.requestMetrics.shift();
    }
  }

  /**
   * Add a query metric
   */
  addQuery(metric: QueryMetric): void {
    this.queryMetrics.push(metric);
    
    // Rotate if over limit (keep newest)
    if (this.queryMetrics.length > this.maxSize) {
      this.queryMetrics.shift();
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get aggregated metrics for a time window
   */
  getAggregated(windowMs?: number): AggregatedMetrics {
    const now = Date.now();
    const cutoff = windowMs ? now - windowMs : 0;

    // Filter metrics by time window
    const filteredRequests = this.requestMetrics.filter(m => m.timestamp >= cutoff);
    const filteredQueries = this.queryMetrics.filter(m => m.timestamp >= cutoff);

    // Request metrics
    const requestDurations = filteredRequests.map(m => m.duration).sort((a, b) => a - b);
    const successfulRequests = filteredRequests.filter(m => m.statusCode < 400);
    const failedRequests = filteredRequests.filter(m => m.statusCode >= 400);

    const byMethod: Record<string, number> = {};
    const byEndpoint: Record<string, { count: number; totalDuration: number }> = {};

    filteredRequests.forEach(m => {
      // Count by method
      byMethod[m.method] = (byMethod[m.method] || 0) + 1;

      // Track by endpoint
      if (!byEndpoint[m.url]) {
        byEndpoint[m.url] = { count: 0, totalDuration: 0 };
      }
      byEndpoint[m.url].count++;
      byEndpoint[m.url].totalDuration += m.duration;
    });

    // Convert to average durations
    const byEndpointAvg: Record<string, { count: number; avgDuration: number }> = {};
    Object.entries(byEndpoint).forEach(([url, data]) => {
      byEndpointAvg[url] = {
        count: data.count,
        avgDuration: data.totalDuration / data.count,
      };
    });

    // Query metrics
    const queryDurations = filteredQueries.map(m => m.duration).sort((a, b) => a - b);
    const successfulQueries = filteredQueries.filter(m => m.success);
    const failedQueries = filteredQueries.filter(m => !m.success);

    const byName: Record<string, { count: number; totalDuration: number }> = {};

    filteredQueries.forEach(m => {
      if (!byName[m.queryName]) {
        byName[m.queryName] = { count: 0, totalDuration: 0 };
      }
      byName[m.queryName].count++;
      byName[m.queryName].totalDuration += m.duration;
    });

    // Convert to average durations
    const byNameAvg: Record<string, { count: number; avgDuration: number }> = {};
    Object.entries(byName).forEach(([name, data]) => {
      byNameAvg[name] = {
        count: data.count,
        avgDuration: data.totalDuration / data.count,
      };
    });

    // Get slowest requests (top 10)
    const slowestRequests = [...filteredRequests]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Get slowest queries (top 10)
    const slowestQueries = [...filteredQueries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const timeRangeStart = filteredRequests.length > 0 
      ? Math.min(...filteredRequests.map(m => m.timestamp))
      : now;

    return {
      requests: {
        total: filteredRequests.length,
        successful: successfulRequests.length,
        failed: failedRequests.length,
        avgDuration: requestDurations.length > 0
          ? requestDurations.reduce((a, b) => a + b, 0) / requestDurations.length
          : 0,
        p50: this.calculatePercentile(requestDurations, 50),
        p95: this.calculatePercentile(requestDurations, 95),
        p99: this.calculatePercentile(requestDurations, 99),
        slowest: slowestRequests,
        byMethod,
        byEndpoint: byEndpointAvg,
      },
      queries: {
        total: filteredQueries.length,
        successful: successfulQueries.length,
        failed: failedQueries.length,
        avgDuration: queryDurations.length > 0
          ? queryDurations.reduce((a, b) => a + b, 0) / queryDurations.length
          : 0,
        p50: this.calculatePercentile(queryDurations, 50),
        p95: this.calculatePercentile(queryDurations, 95),
        p99: this.calculatePercentile(queryDurations, 99),
        slowest: slowestQueries,
        byName: byNameAvg,
      },
      timeRange: {
        start: timeRangeStart,
        end: now,
        durationMs: now - timeRangeStart,
      },
    };
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRequests: number;
    totalQueries: number;
    oldestMetric: number;
    newestMetric: number;
    uptimeMs: number;
  } {
    const now = Date.now();
    const allTimestamps = [
      ...this.requestMetrics.map(m => m.timestamp),
      ...this.queryMetrics.map(m => m.timestamp),
    ];

    return {
      totalRequests: this.requestMetrics.length,
      totalQueries: this.queryMetrics.length,
      oldestMetric: allTimestamps.length > 0 ? Math.min(...allTimestamps) : now,
      newestMetric: allTimestamps.length > 0 ? Math.max(...allTimestamps) : now,
      uptimeMs: now - this.startTime,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.requestMetrics = [];
    this.queryMetrics = [];
  }

  /**
   * Get current buffer sizes
   */
  getBufferInfo(): {
    requestCount: number;
    queryCount: number;
    maxSize: number;
    requestUsage: number;
    queryUsage: number;
  } {
    return {
      requestCount: this.requestMetrics.length,
      queryCount: this.queryMetrics.length,
      maxSize: this.maxSize,
      requestUsage: (this.requestMetrics.length / this.maxSize) * 100,
      queryUsage: (this.queryMetrics.length / this.maxSize) * 100,
    };
  }
}

// Singleton instance
export const metricsStore = new MetricsStore(
  parseInt(process.env.PERF_METRICS_BUFFER_SIZE || '10000', 10)
);
