/**
 * Performance Configuration Verification Script
 * 
 * This script tests that the performance monitoring configuration
 * can be properly loaded from environment variables.
 * 
 * Run with: node --loader ts-node/esm verify-perf-config.ts
 * Or with different env vars:
 *   PERF_SLOW_REQUEST_MS=500 PERF_SLOW_QUERY_MS=50 node verify-perf-config.ts
 */

import { performanceConfig } from './src/middleware/performance';

console.log('\n=== Performance Monitoring Configuration ===\n');

console.log('Environment Variables:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`  PERF_SLOW_REQUEST_MS: ${process.env.PERF_SLOW_REQUEST_MS || 'not set (default: 1000)'}`);
console.log(`  PERF_SLOW_QUERY_MS: ${process.env.PERF_SLOW_QUERY_MS || 'not set (default: 100)'}`);
console.log(`  PERF_LOG_ALL_REQUESTS: ${process.env.PERF_LOG_ALL_REQUESTS || 'not set (auto-detect)'}`);

console.log('\nParsed Configuration:');
console.log(`  slowRequestThreshold: ${performanceConfig.slowRequestThreshold}ms`);
console.log(`  slowQueryThreshold: ${performanceConfig.slowQueryThreshold}ms`);
console.log(`  logAllRequests: ${performanceConfig.logAllRequests}`);

console.log('\nConfiguration Status:');
if (performanceConfig.slowRequestThreshold > 0 && performanceConfig.slowQueryThreshold > 0) {
  console.log('  ✅ Configuration loaded successfully');
  
  // Provide recommendations based on configuration
  if (performanceConfig.slowRequestThreshold < 500) {
    console.log('  ⚠️  Warning: Low request threshold (<500ms) may generate excessive logs');
  }
  
  if (performanceConfig.slowQueryThreshold < 50) {
    console.log('  ⚠️  Warning: Low query threshold (<50ms) may generate excessive logs');
  }
  
  if (performanceConfig.logAllRequests && process.env.NODE_ENV === 'production') {
    console.log('  ⚠️  Warning: Logging all requests in production may impact performance');
  }
  
  console.log('\n');
  process.exit(0);
} else {
  console.log('  ❌ Configuration error: Invalid threshold values');
  console.log('\n');
  process.exit(1);
}
