import os from 'os';
import { _db } from '../db/connection';

/**
 * Resource snapshot at a point in time
 */
export interface ResourceSnapshot {
  timestamp: number;
  memory: {
    heapUsed: number;      // bytes
    heapTotal: number;     // bytes
    external: number;      // bytes
    rss: number;           // bytes (Resident Set Size)
    arrayBuffers: number;  // bytes
  };
  cpu: {
    user: number;          // microseconds
    system: number;        // microseconds
    percent: number;       // 0-100 (calculated)
  };
  database: {
    activeStatements: number;
    preparedStatements: number;
    walCheckpoint: boolean;
  };
  system: {
    totalMemory: number;   // bytes
    freeMemory: number;    // bytes
    loadAverage: number[];  // 1, 5, 15 minute averages (Unix only)
    uptime: number;        // seconds
  };
}

/**
 * Resource alert when thresholds are exceeded
 */
export interface ResourceAlert {
  id: string;
  timestamp: number;
  type: 'memory' | 'cpu' | 'database';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

/**
 * Configuration for resource monitoring
 */
interface ResourceConfig {
  enabled: boolean;
  sampleIntervalMs: number;      // How often to sample
  maxSamples: number;             // Max samples to store
  alertThresholds: {
    memoryUsagePercent: number;   // Alert if heap > X% of total
    cpuPercent: number;            // Alert if CPU > X%
    activeStatements: number;      // Alert if statements > X
  };
}

/**
 * Resource monitoring system
 * Tracks memory, CPU, and database resource usage over time
 */
export class ResourceMonitor {
  private samples: ResourceSnapshot[] = [];
  private alerts: ResourceAlert[] = [];
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastTimestamp: number | null = null;
  private intervalHandle: NodeJS.Timeout | null = null;
  private alertIdCounter = 0;

  constructor(
    private config: ResourceConfig
  ) {
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start automatic resource sampling
   */
  private startMonitoring(): void {
    if (this.intervalHandle) return;

    this.intervalHandle = setInterval(() => {
      this.sample();
    }, this.config.sampleIntervalMs);

    // Take initial sample
    this.sample();
  }

  /**
   * Stop automatic resource sampling
   */
  stopMonitoring(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Take a resource snapshot
   */
  sample(): ResourceSnapshot {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate CPU percentage since last sample
    let cpuPercent = 0;
    if (this.lastCpuUsage && this.lastTimestamp) {
      const elapsedMs = now - this.lastTimestamp;
      const elapsedUs = elapsedMs * 1000;
      
      const userDiff = cpuUsage.user - this.lastCpuUsage.user;
      const systemDiff = cpuUsage.system - this.lastCpuUsage.system;
      const totalDiff = userDiff + systemDiff;
      
      // CPU percent = (cpu time used / wall time elapsed) * 100
      cpuPercent = Math.min(100, (totalDiff / elapsedUs) * 100);
    }

    this.lastCpuUsage = cpuUsage;
    this.lastTimestamp = now;

    // Get database stats
    let activeStatements = 0;
    let preparedStatements = 0;
    let walCheckpoint = false;
    
    try {
      // Count prepared statements (we have 57 pre-compiled)
      const stmts = (_db as any).preparedStatements || [];
      preparedStatements = stmts.length || 57; // Default to known count
      
      // SQLite doesn't track "active" connections like PostgreSQL
      // but we can check if WAL mode is enabled
      const walInfo = _db.pragma('journal_mode', { simple: true });
      walCheckpoint = walInfo === 'wal';
    } catch (err) {
      // Silent fail - not critical
    }

    const snapshot: ResourceSnapshot = {
      timestamp: now,
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        arrayBuffers: memUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        percent: cpuPercent,
      },
      database: {
        activeStatements,
        preparedStatements,
        walCheckpoint,
      },
      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        uptime: os.uptime(),
      },
    };

    // Add to buffer (circular)
    this.samples.push(snapshot);
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift();
    }

    // Check for alerts
    this.checkAlerts(snapshot);

    return snapshot;
  }

  /**
   * Check if current snapshot exceeds alert thresholds
   */
  private checkAlerts(snapshot: ResourceSnapshot): void {
    const { alertThresholds } = this.config;

    // Memory alert
    const memoryUsagePercent = (snapshot.memory.heapUsed / snapshot.memory.heapTotal) * 100;
    if (memoryUsagePercent > alertThresholds.memoryUsagePercent) {
      this.addAlert({
        type: 'memory',
        severity: memoryUsagePercent > 95 ? 'critical' : 'warning',
        message: `High memory usage: ${memoryUsagePercent.toFixed(1)}% of heap`,
        value: memoryUsagePercent,
        threshold: alertThresholds.memoryUsagePercent,
      });
    }

    // CPU alert
    if (snapshot.cpu.percent > alertThresholds.cpuPercent) {
      this.addAlert({
        type: 'cpu',
        severity: snapshot.cpu.percent > 95 ? 'critical' : 'warning',
        message: `High CPU usage: ${snapshot.cpu.percent.toFixed(1)}%`,
        value: snapshot.cpu.percent,
        threshold: alertThresholds.cpuPercent,
      });
    }

    // Database alert (if we had active statements)
    if (snapshot.database.activeStatements > alertThresholds.activeStatements) {
      this.addAlert({
        type: 'database',
        severity: 'warning',
        message: `High database activity: ${snapshot.database.activeStatements} active statements`,
        value: snapshot.database.activeStatements,
        threshold: alertThresholds.activeStatements,
      });
    }
  }

  /**
   * Add an alert (deduplicate recent similar alerts)
   */
  private addAlert(alert: Omit<ResourceAlert, 'id' | 'timestamp'>): void {
    const now = Date.now();
    
    // Check if we already have a recent alert of this type (within last 5 minutes)
    const recentAlert = this.alerts.find(
      a => a.type === alert.type && 
           a.severity === alert.severity && 
           now - a.timestamp < 5 * 60 * 1000
    );
    
    if (recentAlert) return; // Skip duplicate

    const newAlert: ResourceAlert = {
      ...alert,
      id: `alert_${++this.alertIdCounter}`,
      timestamp: now,
    };

    this.alerts.push(newAlert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  /**
   * Get current resource snapshot
   */
  getCurrent(): ResourceSnapshot {
    return this.samples[this.samples.length - 1] || this.sample();
  }

  /**
   * Get historical samples within time window
   */
  getHistory(windowMs?: number): ResourceSnapshot[] {
    if (!windowMs) return [...this.samples];

    const cutoff = Date.now() - windowMs;
    return this.samples.filter(s => s.timestamp >= cutoff);
  }

  /**
   * Get active alerts
   */
  getAlerts(windowMs: number = 60 * 60 * 1000): ResourceAlert[] {
    const cutoff = Date.now() - windowMs;
    return this.alerts.filter(a => a.timestamp >= cutoff);
  }

  /**
   * Get aggregated statistics
   */
  getStats(windowMs?: number): {
    memory: {
      avg: number;
      min: number;
      max: number;
      current: number;
      trend: 'stable' | 'increasing' | 'decreasing';
    };
    cpu: {
      avg: number;
      min: number;
      max: number;
      current: number;
      trend: 'stable' | 'increasing' | 'decreasing';
    };
    sampleCount: number;
    timeRange: { start: number; end: number };
  } {
    const samples = this.getHistory(windowMs);
    
    if (samples.length === 0) {
      const current = this.sample();
      return {
        memory: {
          avg: current.memory.heapUsed,
          min: current.memory.heapUsed,
          max: current.memory.heapUsed,
          current: current.memory.heapUsed,
          trend: 'stable',
        },
        cpu: {
          avg: current.cpu.percent,
          min: current.cpu.percent,
          max: current.cpu.percent,
          current: current.cpu.percent,
          trend: 'stable',
        },
        sampleCount: 1,
        timeRange: { start: current.timestamp, end: current.timestamp },
      };
    }

    // Calculate memory stats
    const memValues = samples.map(s => s.memory.heapUsed);
    const memAvg = memValues.reduce((a, b) => a + b, 0) / memValues.length;
    const memMin = Math.min(...memValues);
    const memMax = Math.max(...memValues);
    const memCurrent = memValues[memValues.length - 1];

    // Calculate CPU stats
    const cpuValues = samples.map(s => s.cpu.percent).filter(v => v > 0);
    const cpuAvg = cpuValues.length > 0 
      ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length 
      : 0;
    const cpuMin = cpuValues.length > 0 ? Math.min(...cpuValues) : 0;
    const cpuMax = cpuValues.length > 0 ? Math.max(...cpuValues) : 0;
    const cpuCurrent = cpuValues[cpuValues.length - 1] || 0;

    // Calculate trends (compare first half vs second half)
    const halfPoint = Math.floor(samples.length / 2);
    const memFirstHalf = memValues.slice(0, halfPoint);
    const memSecondHalf = memValues.slice(halfPoint);
    const memTrend = this.calculateTrend(memFirstHalf, memSecondHalf);

    const cpuFirstHalf = cpuValues.slice(0, halfPoint);
    const cpuSecondHalf = cpuValues.slice(halfPoint);
    const cpuTrend = this.calculateTrend(cpuFirstHalf, cpuSecondHalf);

    return {
      memory: {
        avg: memAvg,
        min: memMin,
        max: memMax,
        current: memCurrent,
        trend: memTrend,
      },
      cpu: {
        avg: cpuAvg,
        min: cpuMin,
        max: cpuMax,
        current: cpuCurrent,
        trend: cpuTrend,
      },
      sampleCount: samples.length,
      timeRange: {
        start: samples[0].timestamp,
        end: samples[samples.length - 1].timestamp,
      },
    };
  }

  /**
   * Calculate trend from two arrays of values
   */
  private calculateTrend(firstHalf: number[], secondHalf: number[]): 'stable' | 'increasing' | 'decreasing' {
    if (firstHalf.length === 0 || secondHalf.length === 0) return 'stable';

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = ((avgSecond - avgFirst) / avgFirst) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Clear all samples and alerts
   */
  clear(): void {
    this.samples = [];
    this.alerts = [];
    this.alertIdCounter = 0;
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    enabled: boolean;
    sampleInterval: number;
    sampleCount: number;
    alertCount: number;
    uptime: number;
  } {
    return {
      enabled: this.config.enabled,
      sampleInterval: this.config.sampleIntervalMs,
      sampleCount: this.samples.length,
      alertCount: this.alerts.length,
      uptime: this.samples.length > 0 
        ? Date.now() - this.samples[0].timestamp 
        : 0,
    };
  }
}

// Default configuration from environment
const config: ResourceConfig = {
  enabled: process.env.RESOURCE_MONITOR_ENABLED !== 'false',
  sampleIntervalMs: parseInt(process.env.RESOURCE_SAMPLE_INTERVAL || '10000', 10), // 10 seconds
  maxSamples: parseInt(process.env.RESOURCE_MAX_SAMPLES || '1000', 10), // ~3 hours at 10s interval
  alertThresholds: {
    memoryUsagePercent: parseInt(process.env.RESOURCE_ALERT_MEMORY_PERCENT || '85', 10),
    cpuPercent: parseInt(process.env.RESOURCE_ALERT_CPU_PERCENT || '80', 10),
    activeStatements: parseInt(process.env.RESOURCE_ALERT_STATEMENTS || '50', 10),
  },
};

// Singleton instance
export const resourceMonitor = new ResourceMonitor(config);

// Graceful shutdown
process.on('SIGTERM', () => {
  resourceMonitor.stopMonitoring();
});

process.on('SIGINT', () => {
  resourceMonitor.stopMonitoring();
});
