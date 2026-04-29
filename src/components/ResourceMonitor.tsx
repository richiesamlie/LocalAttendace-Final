import { useState } from 'react';
import { Activity, Cpu, Database, HardDrive, AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw, Server } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cn } from '../utils/cn';

interface ResourceSnapshot {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
    percent: number;
  };
  database: {
    activeStatements: number;
    preparedStatements: number;
    walCheckpoint: boolean;
  };
  system: {
    totalMemory: number;
    freeMemory: number;
    loadAverage: number[];
    uptime: number;
  };
}

interface ResourceAlert {
  id: string;
  timestamp: number;
  type: 'memory' | 'cpu' | 'database';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

interface ResourceStats {
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
}

interface ResourceData {
  current?: ResourceSnapshot;
  history?: ResourceSnapshot[];
  stats?: ResourceStats;
  status?: {
    enabled: boolean;
    sampleInterval: number;
    sampleCount: number;
    alertCount: number;
    uptime: number;
  };
}

interface AlertsData {
  alerts: ResourceAlert[];
}

type TimeWindow = '15min' | '1hr' | '6hr' | '24hr' | 'all';

const TIME_WINDOWS: Record<TimeWindow, number | undefined> = {
  '15min': 15,
  '1hr': 60,
  '6hr': 360,
  '24hr': 1440,
  'all': undefined,
};

export default function ResourceMonitor() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('1hr');

  const { data: resourceData, isLoading, refetch } = useQuery({
    queryKey: ['resource-monitor', timeWindow],
    queryFn: async () => {
      const windowMinutes = TIME_WINDOWS[timeWindow];
      const response = await api.getResourceHistory(windowMinutes);
      return response as ResourceData;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: alertsData } = useQuery({
    queryKey: ['resource-alerts', timeWindow],
    queryFn: async () => {
      const windowMinutes = TIME_WINDOWS[timeWindow];
      const response = await api.getResourceAlerts(windowMinutes);
      return response as AlertsData;
    },
    refetchInterval: 10000,
  });

  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getTrendIcon = (trend: 'stable' | 'increasing' | 'decreasing') => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'decreasing': return <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default: return <Minus className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getTrendText = (trend: 'stable' | 'increasing' | 'decreasing') => {
    switch (trend) {
      case 'increasing': return 'Increasing';
      case 'decreasing': return 'Decreasing';
      default: return 'Stable';
    }
  };

  const getSeverityColor = (severity: 'warning' | 'critical') => {
    return severity === 'critical'
      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
      : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30';
  };

  const current = resourceData?.current;
  const stats = resourceData?.stats;
  const alerts = alertsData?.alerts || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          Resource Monitor
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Real-time system resource tracking and alerts
        </p>
      </div>

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                Active Alerts ({alerts.length})
              </h3>
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="text-sm text-amber-800 dark:text-amber-300">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium mr-2', getSeverityColor(alert.severity))}>
                      {alert.severity}
                    </span>
                    {alert.message}
                  </div>
                ))}
                {alerts.length > 3 && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    +{alerts.length - 3} more alerts
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TIME_WINDOWS) as TimeWindow[]).map((window) => (
            <button
              key={window}
              onClick={() => setTimeWindow(window)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                timeWindow === window
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
              )}
            >
              {window === 'all' ? 'All Time' : window}
            </button>
          ))}
        </div>

        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Current Resources */}
          {current && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Current Resources</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Memory */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Memory (Heap)</span>
                    <HardDrive className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    {formatBytes(current.memory.heapUsed)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    of {formatBytes(current.memory.heapTotal)}
                  </div>
                  <div className="mt-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 dark:bg-purple-400 transition-all"
                      style={{ width: `${(current.memory.heapUsed / current.memory.heapTotal) * 100}%` }}
                    />
                  </div>
                </div>

                {/* CPU */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">CPU Usage</span>
                    <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    {formatPercent(current.cpu.percent)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    User: {(current.cpu.user / 1000000).toFixed(2)}s
                  </div>
                  <div className="mt-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-400 transition-all"
                      style={{ width: `${Math.min(100, current.cpu.percent)}%` }}
                    />
                  </div>
                </div>

                {/* Database */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Database</span>
                    <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    {current.database.preparedStatements}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Prepared statements
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {current.database.walCheckpoint ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ WAL Enabled</span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">WAL Disabled</span>
                    )}
                  </div>
                </div>

                {/* System Memory */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">System Memory</span>
                    <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                    {formatBytes(current.system.totalMemory - current.system.freeMemory)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    of {formatBytes(current.system.totalMemory)}
                  </div>
                  <div className="mt-2 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all"
                      style={{ width: `${((current.system.totalMemory - current.system.freeMemory) / current.system.totalMemory) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          {stats && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Statistics</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Memory Stats */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      Memory Trends
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      {getTrendIcon(stats.memory.trend)}
                      <span className="text-slate-600 dark:text-slate-400">{getTrendText(stats.memory.trend)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Average</div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatBytes(stats.memory.avg)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current</div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatBytes(stats.memory.current)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Minimum</div>
                      <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {formatBytes(stats.memory.min)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Maximum</div>
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">
                        {formatBytes(stats.memory.max)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CPU Stats */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      CPU Trends
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      {getTrendIcon(stats.cpu.trend)}
                      <span className="text-slate-600 dark:text-slate-400">{getTrendText(stats.cpu.trend)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Average</div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatPercent(stats.cpu.avg)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current</div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {formatPercent(stats.cpu.current)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Minimum</div>
                      <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {formatPercent(stats.cpu.min)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Maximum</div>
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">
                        {formatPercent(stats.cpu.max)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monitor Status */}
          {resourceData?.status && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Monitor Status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">Status</div>
                  <div className={cn('font-medium', resourceData.status.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {resourceData.status.enabled ? '✓ Enabled' : '✗ Disabled'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">Sample Interval</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {resourceData.status.sampleInterval / 1000}s
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">Samples Collected</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {resourceData.status.sampleCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">Monitor Uptime</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {formatUptime(resourceData.status.uptime / 1000)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
