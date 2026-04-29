import { useState } from 'react';
import { Database, Search, AlertTriangle, CheckCircle, AlertCircle, TrendingUp, FileText, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cn } from '../utils/cn';

interface QueryPlan {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

interface ProfileResult {
  query: string;
  plan: QueryPlan[];
  analysis: {
    hasTableScan: boolean;
    usesIndex: boolean;
    indexesUsed: string[];
    tablesScanned: string[];
    estimatedRows: number | null;
  };
  suggestions: string[];
  severity: 'good' | 'warning' | 'critical';
  score: number;
}

interface StatementProfile extends ProfileResult {
  name: string;
}

interface Index {
  name: string;
  table: string;
  sql: string | null;
}

interface TableStat {
  table: string;
  rowCount: number;
}

export default function QueryProfiler() {
  const [activeTab, setActiveTab] = useState<'statements' | 'indexes' | 'custom'>('statements');
  const [customSQL, setCustomSQL] = useState('');
  const [customResult, setCustomResult] = useState<ProfileResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: statementsData, isLoading: statementsLoading } = useQuery({
    queryKey: ['query-profiling-statements'],
    queryFn: async () => {
      const response = await api.getQueryProfilingStatements();
      return response as { statements: StatementProfile[] };
    },
  });

  const { data: indexesData, isLoading: indexesLoading } = useQuery({
    queryKey: ['query-profiling-indexes'],
    queryFn: async () => {
      const response = await api.getQueryProfilingIndexes();
      return response as { indexes: Index[] };
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['query-profiling-stats'],
    queryFn: async () => {
      const response = await api.getQueryProfilingStats();
      return response as { tables: TableStat[]; indexCount: number; totalRows: number };
    },
  });

  const handleAnalyzeCustom = async () => {
    if (!customSQL.trim()) return;

    setIsAnalyzing(true);
    try {
      const response = await api.profileCustomQuery(customSQL);
      setCustomResult(response as ProfileResult);
    } catch (error) {
      console.error('Failed to analyze query:', error);
      setCustomResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: 'good' | 'warning' | 'critical') => {
    switch (severity) {
      case 'good': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30';
      case 'warning': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30';
      case 'critical': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30';
    }
  };

  const getSeverityIcon = (severity: 'good' | 'warning' | 'critical') => {
    switch (severity) {
      case 'good': return <CheckCircle className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />;
      case 'critical': return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const renderProfileResult = (result: ProfileResult, showQuery: boolean = true) => (
    <div className="space-y-4">
      {showQuery && (
        <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Query</h4>
          <code className="text-xs text-slate-900 dark:text-white font-mono break-all">
            {result.query}
          </code>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Optimization Score</div>
          <div className={cn('text-3xl font-bold', getScoreColor(result.score))}>
            {result.score}/100
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Severity</div>
          <div className={cn('flex items-center gap-2 text-lg font-semibold', getSeverityColor(result.severity))}>
            {getSeverityIcon(result.severity)}
            <span className="capitalize">{result.severity}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Index Usage</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {result.analysis.usesIndex ? (
              <span className="text-emerald-600 dark:text-emerald-400">✓ Uses Index</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">✗ No Index</span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Table Scan</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {result.analysis.hasTableScan ? (
              <span className="text-amber-600 dark:text-amber-400">⚠ Full Scan</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">✓ Efficient</span>
            )}
          </div>
        </div>
      </div>

      {result.suggestions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Optimization Suggestions
          </h4>
          <div className="space-y-2">
            {result.suggestions.map((suggestion, idx) => (
              <div key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">{suggestion.startsWith('✅') ? '✅' : suggestion.startsWith('⚠️') ? '⚠️' : '💡'}</span>
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.plan.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Query Execution Plan
          </h4>
          <div className="space-y-1">
            {result.plan.map((step, idx) => (
              <div key={idx} className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 mr-2">[{step.id}]</span>
                {step.detail}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          Query Profiler
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Analyze SQL queries and optimize database performance
        </p>
      </div>

      {/* Stats Summary */}
      {statsData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Tables</span>
              <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{statsData.tables.length}</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Indexes</span>
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{statsData.indexCount}</div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Rows</span>
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              {statsData.totalRows.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('statements')}
          className={cn(
            'px-4 py-2 font-medium text-sm transition-colors',
            activeTab === 'statements'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          Common Queries
        </button>
        <button
          onClick={() => setActiveTab('indexes')}
          className={cn(
            'px-4 py-2 font-medium text-sm transition-colors',
            activeTab === 'indexes'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          Indexes
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={cn(
            'px-4 py-2 font-medium text-sm transition-colors',
            activeTab === 'custom'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          Custom Query
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'statements' && (
        <div className="space-y-6">
          {statementsLoading ? (
            <div className="flex items-center justify-center p-20">
              <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
            </div>
          ) : statementsData?.statements && statementsData.statements.length > 0 ? (
            statementsData.statements.map((stmt) => (
              <div key={stmt.name} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{stmt.name}</h3>
                  <div className={cn('px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2', getSeverityColor(stmt.severity))}>
                    {getSeverityIcon(stmt.severity)}
                    Score: {stmt.score}/100
                  </div>
                </div>
                {renderProfileResult(stmt)}
              </div>
            ))
          ) : (
            <div className="text-center p-10 text-slate-500 dark:text-slate-400">
              No common queries profiled
            </div>
          )}
        </div>
      )}

      {activeTab === 'indexes' && (
        <div className="space-y-4">
          {indexesLoading ? (
            <div className="flex items-center justify-center p-20">
              <div className="w-10 h-10 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin"></div>
            </div>
          ) : indexesData?.indexes && indexesData.indexes.length > 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Index Name</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Table</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {indexesData.indexes.map((index, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-white">{index.name}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{index.table}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {index.sql || 'Auto-generated'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center p-10 text-slate-500 dark:text-slate-400">
              No indexes found
            </div>
          )}

          {statsData && statsData.tables.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Table Statistics</h3>
              <div className="space-y-2">
                {statsData.tables.map((table) => (
                  <div key={table.table} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{table.table}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {table.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'custom' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Analyze Custom Query
            </h3>
            <div className="space-y-4">
              <textarea
                value={customSQL}
                onChange={(e) => setCustomSQL(e.target.value)}
                placeholder="Enter SQL query to analyze... (e.g., SELECT * FROM students WHERE class_id = ?)"
                className="w-full h-32 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={handleAnalyzeCustom}
                disabled={!customSQL.trim() || isAnalyzing}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Analyze Query
                  </>
                )}
              </button>
            </div>
          </div>

          {customResult && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Analysis Results</h3>
              {renderProfileResult(customResult, false)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
