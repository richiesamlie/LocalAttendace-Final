import { useState } from 'react';
import { Activity, Clock, TrendingUp, AlertTriangle, Database, RefreshCw, Trash2, Server } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';

interface MetricsData {
  summary: {
    totalRequests: number;
    totalQueries: number;
    oldestMetric: number;
    newestMetric: number;
    uptimeMs: number;
  };
  bufferInfo: {
    requestCount: number;
    queryCount: number;
    maxSize: number;
    requestUsage: number;
    queryUsage: number;
  };
  metrics: {
    requests: {
      total: number;
      successful: number;
      failed: number;
      avgDuration: number;
      p50: number;
      p95: number;
      p99: number;
      slowest: Array<{
        timestamp: number;
        method: string;
        url: string;
        statusCode: number;
        duration: number;
      }>;
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
      slowest: Array<{
        timestamp: number;
        queryName: string;
        duration: number;
        success: boolean;
      }>;
      byName: Record<string, { count: number; avgDuration: number }>;
    };
    timeRange: {
      start: number;
      end: number;
      durationMs: number;
    };
  };
}

const timeWindows = [
  { label: '15 min', value: 15 },
  { label: '1 hour', value: 60 },
  { label: '6 hours', value: 360 },
  { label: '24 hours', value: 1440 },
  { label: 'All', value: undefined },
];

export default function PerformanceMonitor() {
  const [timeWindow, setTimeWindow] = useState(60); // Default: 1 hour
  const queryClient = useQueryClient();

  const { data: metricsData, isLoading, error, refetch } = useQuery<MetricsData>({
    queryKey: ['performance-metrics', timeWindow],
    queryFn: async () => {
      return api.getPerformanceMetrics(timeWindow);
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const clearMetricsMutation = useMutation({
    mutationFn: async () => {
      return api.clearPerformanceMetrics();
    },
    onSuccess: () => {
      toast.success('Metrics cleared successfully');
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    },
    onError: () => {
      toast.error('Failed to clear metrics');
    },
  });

  const formatDuration = (ms: number) => {
    if (ms < 1) return '< 1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode < 300) return 'text-emerald-600 dark:text-emerald-400';
    if (statusCode < 400) return 'text-blue-600 dark:text-blue-400';
    if (statusCode < 500) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Failed to Load Metrics</h3>
        <p className="text-red-700 dark:text-red-300 text-sm">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
      </div>
    );
  }

  if (!metricsData) {
    return <div className="text-center p-10 text-slate-500">No data available</div>;
  }

  const { summary, bufferInfo, metrics } = metricsData;
  const successRate = metrics.requests.total > 0
    ? ((metrics.requests.successful / metrics.requests.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Performance Monitor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Real-time performance metrics and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => clearMetricsMutation.mutate()}
            disabled={clearMetricsMutation.isPending}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Time Window Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Time Window:</span>
        {timeWindows.map((window) => (
          <button
            key={window.label}
            onClick={() => setTimeWindow(window.value as number)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              timeWindow === window.value
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            {window.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Requests</span>
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{summary.totalRequests}</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{successRate}% success</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Queries</span>
            <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{summary.totalQueries}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics.queries.failed > 0 ? `${metrics.queries.failed} failed` : 'All successful'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Avg Response</span>
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {formatDuration(metrics.requests.avgDuration)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            p95: {formatDuration(metrics.requests.p95)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Server Uptime</span>
            <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {formatUptime(summary.uptimeMs)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Buffer: {bufferInfo.requestUsage.toFixed(1)}% used
          </div>
        </div>
      </div>

      {/* Percentiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Percentiles */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Request Latency Percentiles
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">p50 (Median)</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatDuration(metrics.requests.p50)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">p95</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatDuration(metrics.requests.p95)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">p99</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatDuration(metrics.requests.p99)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">Average</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatDuration(metrics.requests.avgDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Query Percentiles */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Query Latency Percentiles
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">p50 (Median)</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatDuration(metrics.queries.p50)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">p95</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatDuration(metrics.queries.p95)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">p99</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatDuration(metrics.queries.p99)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-600 dark:text-slate-400">Average</span>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatDuration(metrics.queries.avgDuration)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Slowest Requests */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          Slowest Requests
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Time</th>
                <th className="text-left py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Method</th>
                <th className="text-left py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Endpoint</th>
                <th className="text-left py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Status</th>
                <th className="text-right py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Duration</th>
              </tr>
            </thead>
            <tbody>
              {metrics.requests.slowest.slice(0, 10).map((req, idx) => (
                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{formatTimestamp(req.timestamp)}</td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs">
                      {req.method}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-slate-900 dark:text-white font-mono text-xs">{req.url}</td>
                  <td className="py-3 px-2">
                    <span className={cn('font-semibold', getStatusColor(req.statusCode))}>
                      {req.statusCode}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-red-600 dark:text-red-400">
                    {formatDuration(req.duration)}
                  </td>
                </tr>
              ))}
              {metrics.requests.slowest.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    No slow requests recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slowest Queries */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Slowest Database Queries
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Time</th>
                <th className="text-left py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Query Name</th>
                <th className="text-left py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Status</th>
                <th className="text-right py-3 px-2 font-medium text-slate-600 dark:text-slate-400">Duration</th>
              </tr>
            </thead>
            <tbody>
              {metrics.queries.slowest.slice(0, 10).map((query, idx) => (
                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{formatTimestamp(query.timestamp)}</td>
                  <td className="py-3 px-2 text-slate-900 dark:text-white font-mono text-xs">{query.queryName}</td>
                  <td className="py-3 px-2">
                    {query.success ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Success</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-semibold">Failed</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-amber-600 dark:text-amber-400">
                    {formatDuration(query.duration)}
                  </td>
                </tr>
              ))}
              {metrics.queries.slowest.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    No slow queries recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Requests by Method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Requests by HTTP Method</h3>
          <div className="space-y-2">
            {Object.entries(metrics.requests.byMethod)
              .sort(([, a], [, b]) => b - a)
              .map(([method, count]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{method}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full"
                        style={{ width: `${(count / metrics.requests.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white w-12 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Top Endpoints */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Top Endpoints by Traffic</h3>
          <div className="space-y-2">
            {Object.entries(metrics.requests.byEndpoint)
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 5)
              .map(([endpoint, data]) => (
                <div key={endpoint} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-900 dark:text-white font-mono truncate max-w-[200px]">
                      {endpoint}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {data.count} req
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                      <div
                        className="bg-purple-600 dark:bg-purple-400 h-1.5 rounded-full"
                        style={{ width: `${(data.count / metrics.requests.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDuration(data.avgDuration)} avg
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
