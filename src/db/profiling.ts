/**
 * Query Profiling Utility
 * 
 * Provides SQL query analysis and optimization suggestions using EXPLAIN QUERY PLAN.
 * Helps identify slow queries and missing indexes.
 * 
 * Features:
 * - EXPLAIN QUERY PLAN analysis
 * - Index usage detection
 * - Full table scan detection
 * - Query optimization suggestions
 * - Performance recommendations
 */

import { _db } from './connection';

export interface QueryPlan {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

export interface ProfileResult {
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
}

/**
 * Analyze a SQL query using EXPLAIN QUERY PLAN
 */
export function profileQuery(sql: string): ProfileResult {
  try {
    // Get query plan
    const plan = _db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as QueryPlan[];
    
    // Analyze the plan
    const analysis = analyzePlan(plan);
    
    // Generate suggestions
    const suggestions = generateSuggestions(sql, plan, analysis);
    
    // Determine severity
    const severity = determineSeverity(analysis);
    
    return {
      query: sql,
      plan,
      analysis,
      suggestions,
      severity,
    };
  } catch (error) {
    throw new Error(`Failed to profile query: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze query plan to extract performance insights
 */
function analyzePlan(plan: QueryPlan[]): ProfileResult['analysis'] {
  const details = plan.map(p => p.detail.toLowerCase());
  const detailText = details.join(' ');
  
  // Check for table scans
  const hasTableScan = details.some(d => 
    d.includes('scan table') && !d.includes('using index')
  );
  
  // Check for index usage
  const usesIndex = details.some(d => 
    d.includes('using index') || 
    d.includes('using covering index') ||
    d.includes('search table') && d.includes('using index')
  );
  
  // Extract indexes used
  const indexesUsed: string[] = [];
  const indexRegex = /(?:using (?:covering )?index|index) ([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = indexRegex.exec(detailText)) !== null) {
    if (match[1] && !indexesUsed.includes(match[1])) {
      indexesUsed.push(match[1]);
    }
  }
  
  // Extract tables scanned
  const tablesScanned: string[] = [];
  const tableRegex = /(?:scan|search) (?:table|index) ([a-zA-Z0-9_]+)/g;
  while ((match = tableRegex.exec(detailText)) !== null) {
    if (match[1] && !tablesScanned.includes(match[1]) && !indexesUsed.includes(match[1])) {
      tablesScanned.push(match[1]);
    }
  }
  
  // Estimate rows (look for row count estimates in detail)
  let estimatedRows: number | null = null;
  const rowsMatch = detailText.match(/~(\d+) rows?/);
  if (rowsMatch) {
    estimatedRows = parseInt(rowsMatch[1], 10);
  }
  
  return {
    hasTableScan,
    usesIndex,
    indexesUsed,
    tablesScanned,
    estimatedRows,
  };
}

/**
 * Generate optimization suggestions based on query analysis
 */
function generateSuggestions(sql: string, _plan: QueryPlan[], analysis: ProfileResult['analysis']): string[] {
  const suggestions: string[] = [];
  
  // Full table scan without index
  if (analysis.hasTableScan && !analysis.usesIndex) {
    suggestions.push('⚠️ Query performs a full table scan. Consider adding an index on the filter columns.');
    
    // Try to identify which columns might benefit from indexes
    const whereMatch = sql.match(/WHERE\s+([a-zA-Z0-9_]+)\s*=/i);
    if (whereMatch) {
      suggestions.push(`💡 Consider creating index: CREATE INDEX idx_${whereMatch[1]} ON table_name(${whereMatch[1]});`);
    }
  }
  
  // Multiple table scans
  if (analysis.tablesScanned.length > 1 && analysis.hasTableScan) {
    suggestions.push(`⚠️ Query scans ${analysis.tablesScanned.length} tables without indexes. This may be slow with large datasets.`);
  }
  
  // Good: Using index
  if (analysis.usesIndex && !analysis.hasTableScan) {
    suggestions.push('✅ Query efficiently uses indexes. Performance should be good.');
  }
  
  // Check for SELECT *
  if (sql.trim().toLowerCase().includes('select *')) {
    suggestions.push('💡 Avoid SELECT *. Specify only the columns you need to reduce data transfer.');
  }
  
  // Check for ORDER BY without index
  if (sql.toLowerCase().includes('order by')) {
    const orderByMatch = sql.match(/ORDER BY\s+([a-zA-Z0-9_]+)/i);
    if (orderByMatch && !analysis.indexesUsed.some(idx => idx.includes(orderByMatch[1]))) {
      suggestions.push(`💡 ORDER BY on ${orderByMatch[1]} may benefit from an index.`);
    }
  }
  
  // Check for LIKE with leading wildcard
  if (sql.match(/LIKE\s+['"]%/i)) {
    suggestions.push('⚠️ LIKE with leading wildcard (LIKE \'%...%\') cannot use indexes efficiently.');
  }
  
  // Large estimated rows without LIMIT
  if (analysis.estimatedRows && analysis.estimatedRows > 1000 && !sql.toLowerCase().includes('limit')) {
    suggestions.push(`💡 Query may return ${analysis.estimatedRows}+ rows. Consider adding LIMIT for pagination.`);
  }
  
  // No issues found
  if (suggestions.length === 0) {
    suggestions.push('✅ Query looks well-optimized. No immediate concerns detected.');
  }
  
  return suggestions;
}

/**
 * Determine severity level based on analysis
 */
function determineSeverity(analysis: ProfileResult['analysis']): ProfileResult['severity'] {
  // Critical: Full table scan on multiple tables
  if (analysis.hasTableScan && analysis.tablesScanned.length > 2) {
    return 'critical';
  }
  
  // Warning: Full table scan or no index usage
  if (analysis.hasTableScan || !analysis.usesIndex) {
    return 'warning';
  }
  
  // Good: Using indexes efficiently
  return 'good';
}

/**
 * Profile all prepared statements in the application
 */
export function profileAllStatements(): Map<string, ProfileResult> {
  const results = new Map<string, ProfileResult>();
  
  // Common queries to profile (examples - expand based on actual app queries)
  const commonQueries = [
    { name: 'getStudentsByClass', sql: 'SELECT * FROM students WHERE class_id = ? AND archived = 0' },
    { name: 'getRecordsByClass', sql: 'SELECT * FROM records WHERE class_id = ?' },
    { name: 'getEventsByClass', sql: 'SELECT * FROM events WHERE class_id = ? ORDER BY date DESC' },
    { name: 'getTimetableByClass', sql: 'SELECT * FROM timetable WHERE class_id = ?' },
    { name: 'getDailyNotesByClass', sql: 'SELECT * FROM daily_notes WHERE class_id = ?' },
    { name: 'getClassesByTeacher', sql: 'SELECT * FROM classes c LEFT JOIN class_teachers ct ON c.id = ct.class_id WHERE ct.teacher_id = ?' },
    { name: 'getTeacherSessions', sql: 'SELECT * FROM sessions WHERE teacher_id = ? AND is_revoked = 0 AND expires_at > datetime("now")' },
  ];
  
  for (const { name, sql } of commonQueries) {
    try {
      const result = profileQuery(sql);
      results.set(name, result);
    } catch (error) {
      console.error(`Failed to profile ${name}:`, error);
    }
  }
  
  return results;
}

/**
 * Get list of all indexes in the database
 */
export function getAllIndexes(): Array<{ name: string; table: string; sql: string | null }> {
  const indexes = _db.prepare(`
    SELECT name, tbl_name as 'table', sql
    FROM sqlite_master 
    WHERE type = 'index' 
      AND name NOT LIKE 'sqlite_%'
    ORDER BY tbl_name, name
  `).all() as Array<{ name: string; table: string; sql: string | null }>;
  
  return indexes;
}

/**
 * Get table statistics (row counts, size estimates)
 */
export function getTableStats(): Array<{ table: string; rowCount: number }> {
  const tables = _db.prepare(`
    SELECT name 
    FROM sqlite_master 
    WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;
  
  const stats = tables.map(({ name }) => {
    const result = _db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get() as { count: number };
    return {
      table: name,
      rowCount: result.count,
    };
  });
  
  return stats;
}

/**
 * Analyze query and provide optimization score (0-100)
 */
export function getOptimizationScore(result: ProfileResult): number {
  let score = 100;
  
  // Deduct points for issues
  if (result.analysis.hasTableScan) score -= 40;
  if (!result.analysis.usesIndex) score -= 30;
  if (result.analysis.tablesScanned.length > 2) score -= 20;
  if (result.query.toLowerCase().includes('select *')) score -= 10;
  
  return Math.max(0, score);
}
