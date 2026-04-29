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

### Thresholds

- **Slow Request**: 1000ms (1 second)
- **Slow Query**: 100ms (default, customizable)

### Logging Behavior

- **Development** (`NODE_ENV !== 'production'`):
  - All requests logged
  - All queries logged
  - Slow operations logged as warnings

- **Production** (`NODE_ENV === 'production'`):
  - Only slow requests logged
  - Only slow queries logged
  - Normal operations silent

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

## Future Enhancements

Potential improvements:

1. **Metrics Aggregation**: Collect and aggregate metrics over time
2. **Dashboard**: Create admin dashboard for performance metrics
3. **Query Profiling**: Detailed SQL query profiling with EXPLAIN
4. **Resource Monitoring**: Track memory, CPU, and database connections
5. **Distributed Tracing**: Track requests across microservices (if architecture expands)
6. **Custom Thresholds**: Allow configuration via environment variables
