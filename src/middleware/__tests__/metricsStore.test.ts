import { describe, it, expect, beforeEach } from 'vitest';
import { metricsStore } from '../metricsStore';

describe('MetricsStore', () => {
  beforeEach(() => {
    // Clear metrics before each test
    metricsStore.clear();
  });

  describe('Request Metrics', () => {
    it('should store request metrics', () => {
      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/classes',
        statusCode: 200,
        duration: 45,
      });

      const summary = metricsStore.getSummary();
      expect(summary.totalRequests).toBe(1);
    });

    it('should calculate percentiles correctly', () => {
      // Add requests with varying durations
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      durations.forEach((duration) => {
        metricsStore.addRequest({
          timestamp: Date.now(),
          method: 'GET',
          url: '/api/test',
          statusCode: 200,
          duration,
        });
      });

      const aggregated = metricsStore.getAggregated();
      
      // p50 should be around 50ms
      expect(aggregated.requests.p50).toBeGreaterThanOrEqual(45);
      expect(aggregated.requests.p50).toBeLessThanOrEqual(55);
      
      // p95 should be around 95ms
      expect(aggregated.requests.p95).toBeGreaterThanOrEqual(90);
      expect(aggregated.requests.p95).toBeLessThanOrEqual(100);
    });

    it('should track requests by method', () => {
      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/classes',
        statusCode: 200,
        duration: 45,
      });

      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'POST',
        url: '/api/classes',
        statusCode: 201,
        duration: 120,
      });

      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/students',
        statusCode: 200,
        duration: 30,
      });

      const aggregated = metricsStore.getAggregated();
      expect(aggregated.requests.byMethod['GET']).toBe(2);
      expect(aggregated.requests.byMethod['POST']).toBe(1);
    });

    it('should track requests by endpoint', () => {
      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/classes',
        statusCode: 200,
        duration: 45,
      });

      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/classes',
        statusCode: 200,
        duration: 55,
      });

      const aggregated = metricsStore.getAggregated();
      const classesEndpoint = aggregated.requests.byEndpoint['/api/classes'];
      
      expect(classesEndpoint.count).toBe(2);
      expect(classesEndpoint.avgDuration).toBe(50); // (45 + 55) / 2
    });

    it('should identify slowest requests', () => {
      const durations = [10, 20, 30, 500, 40];
      durations.forEach((duration) => {
        metricsStore.addRequest({
          timestamp: Date.now(),
          method: 'GET',
          url: '/api/test',
          statusCode: 200,
          duration,
        });
      });

      const aggregated = metricsStore.getAggregated();
      expect(aggregated.requests.slowest[0].duration).toBe(500);
    });

    it('should separate successful and failed requests', () => {
      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/classes',
        statusCode: 200,
        duration: 45,
      });

      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'POST',
        url: '/api/classes',
        statusCode: 400,
        duration: 30,
      });

      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/students',
        statusCode: 500,
        duration: 100,
      });

      const aggregated = metricsStore.getAggregated();
      expect(aggregated.requests.successful).toBe(1); // Only 200
      expect(aggregated.requests.failed).toBe(2); // 400 and 500
    });
  });

  describe('Query Metrics', () => {
    it('should store query metrics', () => {
      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName: 'getStudentsByClass',
        duration: 15,
        success: true,
      });

      const summary = metricsStore.getSummary();
      expect(summary.totalQueries).toBe(1);
    });

    it('should calculate query percentiles', () => {
      const durations = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
      durations.forEach((duration) => {
        metricsStore.addQuery({
          timestamp: Date.now(),
          queryName: 'testQuery',
          duration,
          success: true,
        });
      });

      const aggregated = metricsStore.getAggregated();
      
      expect(aggregated.queries.p50).toBeGreaterThanOrEqual(22);
      expect(aggregated.queries.p50).toBeLessThanOrEqual(28);
    });

    it('should track queries by name', () => {
      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName: 'getStudentsByClass',
        duration: 15,
        success: true,
      });

      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName: 'getStudentsByClass',
        duration: 20,
        success: true,
      });

      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName: 'saveAttendance',
        duration: 30,
        success: true,
      });

      const aggregated = metricsStore.getAggregated();
      const studentQuery = aggregated.queries.byName['getStudentsByClass'];
      
      expect(studentQuery.count).toBe(2);
      expect(studentQuery.avgDuration).toBe(17.5); // (15 + 20) / 2
    });

    it('should separate successful and failed queries', () => {
      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName: 'query1',
        duration: 15,
        success: true,
      });

      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName: 'query2',
        duration: 20,
        success: false,
      });

      const aggregated = metricsStore.getAggregated();
      expect(aggregated.queries.successful).toBe(1);
      expect(aggregated.queries.failed).toBe(1);
    });
  });

  describe('Time Windows', () => {
    it('should filter metrics by time window', () => {
      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);
      const oneHourAgo = now - (60 * 60 * 1000);

      // Add old metric
      metricsStore.addRequest({
        timestamp: twoHoursAgo,
        method: 'GET',
        url: '/api/old',
        statusCode: 200,
        duration: 100,
      });

      // Add recent metric
      metricsStore.addRequest({
        timestamp: oneHourAgo,
        method: 'GET',
        url: '/api/recent',
        statusCode: 200,
        duration: 50,
      });

      // Get metrics for last hour
      const oneHourWindow = 60 * 60 * 1000;
      const aggregated = metricsStore.getAggregated(oneHourWindow);

      // Should only include the recent metric
      expect(aggregated.requests.total).toBe(1);
    });
  });

  describe('Buffer Management', () => {
    it('should report buffer usage', () => {
      // Add 50 requests
      for (let i = 0; i < 50; i++) {
        metricsStore.addRequest({
          timestamp: Date.now(),
          method: 'GET',
          url: '/api/test',
          statusCode: 200,
          duration: 10,
        });
      }

      const bufferInfo = metricsStore.getBufferInfo();
      expect(bufferInfo.requestCount).toBe(50);
      expect(bufferInfo.requestUsage).toBeGreaterThan(0);
      expect(bufferInfo.requestUsage).toBeLessThan(100);
    });

    it('should clear all metrics', () => {
      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: 10,
      });

      metricsStore.addQuery({
        timestamp: Date.now(),
        queryName: 'test',
        duration: 5,
        success: true,
      });

      metricsStore.clear();

      const summary = metricsStore.getSummary();
      expect(summary.totalRequests).toBe(0);
      expect(summary.totalQueries).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty metrics', () => {
      const aggregated = metricsStore.getAggregated();
      
      expect(aggregated.requests.total).toBe(0);
      expect(aggregated.requests.avgDuration).toBe(0);
      expect(aggregated.requests.p50).toBe(0);
      expect(aggregated.queries.total).toBe(0);
    });

    it('should handle single metric', () => {
      metricsStore.addRequest({
        timestamp: Date.now(),
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: 100,
      });

      const aggregated = metricsStore.getAggregated();
      expect(aggregated.requests.p50).toBe(100);
      expect(aggregated.requests.p95).toBe(100);
      expect(aggregated.requests.p99).toBe(100);
    });
  });
});
