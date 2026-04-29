# Performance Monitoring

This document describes the performance monitoring system implemented in the application.

## Overview

The application now includes comprehensive performance monitoring to identify slow requests and database operations.

## Components

### 1. Request Monitoring Middleware

**Location**: `src/middleware/performance.ts`

**Features**:
- Tracks duration of every HTTP request
- Logs slow requests (>1000ms threshold) as warnings
- Logs all requests in development mode
- Captures method, URL, status code, and duration

**Implementation**:
```typescript
import { performanceMonitor } from './src/middleware/performance';

// In server.ts
app.use(performanceMonitor);
```

**Example output**:
```
[2026-04-29 10:15:23] GET /api/classes 200 45ms
[SLOW REQUEST] 2026-04-29 10:15:30 POST /api/students 201 1250ms
```

### 2. Query Monitoring Utility

**Location**: `src/middleware/performance.ts` (`monitorQuery` function)

**Features**:
- Wraps database queries to track execution time
- Detects slow queries (>100ms threshold by default)
- Logs query name, duration, and errors
- Customizable threshold per query

**Usage Example**:
```typescript
import { monitorQuery } from '../middleware/performance';

// Wrap a database query
async function getStudentsByClass(classId: string) {
  return monitorQuery(
    'getStudentsByClass',
    () => db.stmt.getStudentsByClass.all(classId),
    100 // threshold in milliseconds (optional)
  );
}

// Wrap an async operation
async function complexOperation() {
  return monitorQuery(
    'complexCalculation',
    async () => {
      // Complex logic here
      return result;
    },
    200 // custom threshold
  );
}
```

**Example output**:
```
[QUERY] 2026-04-29 10:15:23 getStudentsByClass completed in 15ms
[SLOW QUERY] 2026-04-29 10:15:45 fetchAttendanceReport took 150ms
[QUERY ERROR] 2026-04-29 10:16:00 getRecordsByClass failed after 50ms: Error message
```

## Configuration

### Environment Variables

The performance monitoring system can be configured via environment variables:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PERF_SLOW_REQUEST_MS` | Threshold for slow HTTP requests (milliseconds) | `1000` | `500` |
| `PERF_SLOW_QUERY_MS` | Threshold for slow database queries (milliseconds) | `100` | `150` |
| `PERF_LOG_ALL_REQUESTS` | Log all requests regardless of speed | `true` (dev)<br>`false` (prod) | `true` |

**Example `.env` configuration**:
```bash
# Performance Monitoring Configuration
PERF_SLOW_REQUEST_MS=1000      # Log requests slower than 1 second
PERF_SLOW_QUERY_MS=100         # Log queries slower than 100ms
PERF_LOG_ALL_REQUESTS=false    # Only log slow operations (production mode)
```

**Use Cases**:

- **SQLite Setup**: Use higher thresholds (e.g., `PERF_SLOW_QUERY_MS=150`)
- **PostgreSQL Setup**: Use lower thresholds (e.g., `PERF_SLOW_QUERY_MS=50`)
- **Old Hardware**: Increase thresholds to reduce noise
- **Performance Tuning**: Enable all logging temporarily to identify bottlenecks
- **Silent Production**: Set `PERF_LOG_ALL_REQUESTS=false` to only see problems

### Default Thresholds

- **Slow Request**: 1000ms (1 second) - configurable via `PERF_SLOW_REQUEST_MS`
- **Slow Query**: 100ms - configurable via `PERF_SLOW_QUERY_MS`

### Logging Behavior

- **Development** (`NODE_ENV !== 'production'`):
  - All requests logged (unless `PERF_LOG_ALL_REQUESTS=false`)
  - All queries logged (unless `PERF_LOG_ALL_REQUESTS=false`)
  - Slow operations logged as warnings

- **Production** (`NODE_ENV === 'production'`):
  - Only slow requests logged (unless `PERF_LOG_ALL_REQUESTS=true`)
  - Only slow queries logged (unless `PERF_LOG_ALL_REQUESTS=true`)
  - Normal operations silent (reduce log volume)

## Rate Limiting Configuration

The application is configured to handle ~40 concurrent teacher logins during morning rush:

**Auth Limiter** (`/api/auth/login`):
- Max: 150 requests per 15 minutes per IP
- Only counts failed login attempts (`skipSuccessfulRequests: true`)
- Configured for morning login rush

**POST Limiter** (general POST endpoints):
- Max: 500 requests per 15 minutes per IP
- Handles multiple concurrent users creating/updating data

**Configuration**: `src/routes/middleware.ts`

## Monitoring in Practice

### Identifying Performance Issues

1. **Check console logs** for `[SLOW REQUEST]` and `[SLOW QUERY]` entries
2. **Review patterns**: Which endpoints/queries are consistently slow?
3. **Correlate with load**: Do slow operations occur during peak usage?

### Common Slow Operations

Monitor these operations closely:

- **Student bulk operations**: Creating/updating many students
- **Attendance reports**: Large date ranges or multiple classes
- **Seating layout updates**: Atomic updates with many seats
- **Database migrations**: Schema changes and data migrations

### Optimization Strategies

1. **Database Indexes**: Ensure proper indexes on frequently queried columns
2. **Query Optimization**: Review slow query SQL for optimization opportunities
3. **Caching**: Use React Query for client-side caching (already implemented)
4. **Pagination**: Limit large result sets
5. **Background Jobs**: Move long operations to background tasks

## Database Optimization

The application uses **prepared statements** (pre-compiled SQL) for all database operations:

**Location**: `src/db/statements.ts`

**Benefits**:
- Faster execution (SQL pre-compiled)
- Protection against SQL injection
- Reduced parsing overhead

**Current count**: 57 prepared statements

## WebSocket Monitoring

The application uses **signal-only WebSocket events** for real-time updates:

**Pattern**:
- Server emits signal events (no data payload)
- Client uses React Query to fetch updated data
- Reduces bandwidth and improves performance

**Implementation**:
```typescript
// Server: Signal event
io.to(classId).emit('students_updated');

// Client: Refetch data on signal
useEffect(() => {
  socket.on('students_updated', () => {
    queryClient.invalidateQueries(['students', classId]);
  });
}, [classId]);
```

## Production Considerations

1. **Log Rotation**: Implement log rotation for production logs
2. **Monitoring Tools**: Consider integrating with monitoring services (e.g., Sentry, DataDog)
3. **Alerts**: Set up alerts for excessive slow queries/requests
4. **Performance Budget**: Track performance metrics over time

## Testing Performance Configuration

To verify performance monitoring configuration:

1. **Check current configuration**:
   ```bash
   npx tsx verify-perf-config.ts
   ```

2. **Test with custom thresholds**:
   ```bash
   # PowerShell
   $env:PERF_SLOW_REQUEST_MS="500"; $env:PERF_SLOW_QUERY_MS="50"; npx tsx verify-perf-config.ts
   
   # Bash/Linux
   PERF_SLOW_REQUEST_MS=500 PERF_SLOW_QUERY_MS=50 npx tsx verify-perf-config.ts
   ```

## Testing Performance

To test performance monitoring:

1. **Start server in development mode**:
   ```bash
   npm run dev
   ```

2. **Make requests and observe logs**:
   ```bash
   # Example: Create 50 students
   for ($i=1; $i -le 50; $i++) {
     curl -X POST http://localhost:3000/api/students -H "Content-Type: application/json" -d "{\"name\":\"Student $i\"}"
   }
   ```

3. **Check for slow operations** in console output

4. **Production testing**:
   ```bash
   NODE_ENV=production npm start
   # Only slow operations will be logged
   ```

5. **Test with custom thresholds**:
   ```bash
   # Set aggressive thresholds for testing
   PERF_SLOW_REQUEST_MS=100 PERF_SLOW_QUERY_MS=10 npm run dev
   ```

## Implemented Enhancements

✅ **Custom Thresholds** (April 29, 2026): Configuration via environment variables
   - `PERF_SLOW_REQUEST_MS` - Configurable request threshold
   - `PERF_SLOW_QUERY_MS` - Configurable query threshold
   - `PERF_LOG_ALL_REQUESTS` - Toggle all request logging
   - Adapts to hardware capabilities (SQLite vs PostgreSQL)
   - Production-ready with sensible defaults

✅ **Metrics Aggregation** (April 29, 2026): Collect and analyze performance data
  - In-memory circular buffer stores last 10,000 metrics
  - Request metrics: duration, status code, method, endpoint
  - Query metrics: duration, success/failure, query name
  - Percentile calculations (p50, p95, p99)
  - Time-windowed queries (e.g., last hour, last 24 hours)
  - Admin API endpoints: `/api/admin/metrics`, `/api/admin/metrics/summary`
  - Configurable via `PERF_METRICS_ENABLED` and `PERF_METRICS_BUFFER_SIZE`
  - Zero database overhead (all in-memory)

✅ **Dashboard** (April 29, 2026): Visual performance monitoring interface
  - React-based admin dashboard at `/performance` route
  - Real-time metrics display with 10-second auto-refresh
  - Time window selector (15min, 1hr, 6hr, 24hr, all)
  - Summary cards: total requests, queries, avg response time, server uptime
  - Percentile visualizations (p50, p95, p99) for requests and queries
  - Slowest requests table with method, endpoint, status, duration
  - Slowest queries table with query name, status, duration
  - Request breakdown by HTTP method with visual progress bars
  - Top endpoints by traffic with average duration
  - One-click metrics clearing (admin only)
  - Dark mode support
  - Mobile-responsive design

### Using Metrics Aggregation

The metrics system automatically collects performance data for all requests and database queries. Admin users can access this data via API endpoints.

**Environment Variables**:
```bash
# Enable/disable metrics collection (default: true)
PERF_METRICS_ENABLED=true

# Maximum metrics to store (default: 10000)
# Older metrics are automatically rotated out
PERF_METRICS_BUFFER_SIZE=10000
```

**API Endpoints** (Admin only):

1. **Get Aggregated Metrics** - `GET /api/admin/metrics?window=60`
   
   Query parameters:
   - `window` (optional): Time window in minutes (default: 60)
   
   Returns comprehensive metrics including:
   - Request statistics (total, successful, failed, avg duration, percentiles)
   - Query statistics (total, successful, failed, avg duration, percentiles)
   - Top 10 slowest requests and queries
   - Breakdown by HTTP method and endpoint
   - Time range information

   Example:
   ```bash
   # Get metrics for last hour (default)
   curl -H "Cookie: session=..." http://localhost:3000/api/admin/metrics
   
   # Get metrics for last 24 hours
   curl -H "Cookie: session=..." http://localhost:3000/api/admin/metrics?window=1440
   ```

2. **Get Metrics Summary** - `GET /api/admin/metrics/summary`
   
   Returns a quick overview:
   - Total requests and queries collected
   - Oldest and newest metric timestamps
   - Server uptime
   - Buffer usage information

3. **Clear Metrics** - `DELETE /api/admin/metrics`
   
   Clears all collected metrics. Useful for:
   - Starting fresh after deployment
   - Removing test data
   - Troubleshooting

**Sample Response** (GET /api/admin/metrics):
```json
{
  "summary": {
    "totalRequests": 1250,
    "totalQueries": 3840,
    "oldestMetric": 1714388400000,
    "newestMetric": 1714392000000,
    "uptimeMs": 3600000
  },
  "bufferInfo": {
    "requestCount": 1250,
    "queryCount": 3840,
    "maxSize": 10000,
    "requestUsage": 12.5,
    "queryUsage": 38.4
  },
  "metrics": {
    "requests": {
      "total": 1250,
      "successful": 1230,
      "failed": 20,
      "avgDuration": 45.5,
      "p50": 38,
      "p95": 120,
      "p99": 450,
      "slowest": [
        {
          "timestamp": 1714391800000,
          "method": "POST",
          "url": "/api/students",
          "statusCode": 201,
          "duration": 1250
        }
      ],
      "byMethod": {
        "GET": 800,
        "POST": 300,
        "PUT": 100,
        "DELETE": 50
      },
      "byEndpoint": {
        "/api/classes": { "count": 150, "avgDuration": 25.5 },
        "/api/students": { "count": 420, "avgDuration": 65.2 }
      }
    },
    "queries": {
      "total": 3840,
      "successful": 3835,
      "failed": 5,
      "avgDuration": 15.2,
      "p50": 12,
      "p95": 45,
      "p99": 120,
      "slowest": [
        {
          "timestamp": 1714391750000,
          "queryName": "getAttendanceReport",
          "duration": 185,
          "success": true
        }
      ],
      "byName": {
        "getStudentsByClass": { "count": 850, "avgDuration": 8.5 },
        "saveAttendance": { "count": 600, "avgDuration": 22.3 }
      }
    },
    "timeRange": {
      "start": 1714388400000,
      "end": 1714392000000,
      "durationMs": 3600000
    }
  }
}
```

**Use Cases**:
- **Performance Analysis**: Identify slowest endpoints and queries
- **Capacity Planning**: Monitor request rates and response times
- **Optimization**: Use percentiles to understand typical vs worst-case performance
- **Debugging**: Correlate slow operations with user reports
- **Trending**: Compare metrics across different time windows

## Future Enhancements

Recommended priority order:

1. **Query Profiling** ⭐ (Next Priority)
   - Detailed SQL query profiling with EXPLAIN
   - Identify missing indexes
   - Query optimization suggestions
   - Only needed when performance issues arise

2. **Resource Monitoring**
   - Track memory, CPU, and database connections
   - Detect memory leaks
   - Alert on resource exhaustion
   - Integration with system monitoring tools

3. **Distributed Tracing**
   - Track requests across microservices
   - Only relevant if architecture expands
   - Not applicable to current monolithic design
