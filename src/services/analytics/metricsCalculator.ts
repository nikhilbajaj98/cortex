import { CortexEvent } from '../../api/shared/types/event';
import logger from '../../utils/logger';

export interface ServiceMetrics {
  service: string;
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: number; // requests per second
}

export class MetricsCalculator {
  private metricsCache: Map<string, ServiceMetrics> = new Map();

  constructor() {
    logger.info('MetricsCalculator initialized');
  }

  /**
   * Calculate service metrics from events for a given time window
   * 
   * @param service - Service name
   * @param events - Events to calculate metrics from (typically recent batch events)
   * @param timeWindow - Time window string ('1m', '5m', '15m', '1h'). Default: '5m'
   * 
   * @note This method filters events based on the time window, but only sees events
   *       in the provided array. For longer windows (15m, 1h) or historical data,
   *       use ClickHouse queries via analyticsRepository.getServiceMetrics()
   * 
   * @note Cache keys include timeWindow (format: "service:timeWindow") to support
   *       multiple time windows per service
   */
  public async calculateServiceMetrics(
    service: string, 
    events: CortexEvent[], 
    timeWindow: string = '5m'
  ): Promise<ServiceMetrics> {
    try {
      const metrics = this.computeMetrics(service, events, timeWindow);
      
      // Cache the metrics (key includes timeWindow for multi-window support)
      const cacheKey = `${service}:${timeWindow}`;
      this.metricsCache.set(cacheKey, metrics);
      
      return metrics;
    } catch (error) {
      logger.error(`❌ Error calculating metrics for service ${service}: ${error}`);
      throw error;
    }
  }

  private computeMetrics(service: string, events: CortexEvent[], timeWindow: string = '5m'): ServiceMetrics {
    const now = new Date().toISOString();
    
    // Convert time window string to milliseconds
    const windowMs = this.parseTimeWindow(timeWindow);
    const cutoffTime = new Date(Date.now() - windowMs);
    
    const recentEvents = events.filter(event => 
      new Date(event.timestamp) > cutoffTime
    );

    if (recentEvents.length === 0) {
      return this.getEmptyMetrics(service, now);
    }

    // Calculate basic metrics
    const totalRequests = recentEvents.length;
    const successfulRequests = recentEvents.filter(e => e.status >= 200 && e.status < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    // Calculate latency metrics
    const latencies = recentEvents.map(e => e.latency).filter(l => l > 0);
    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    
    // Calculate percentiles
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p50Latency = this.calculatePercentile(sortedLatencies, 50);
    const p95Latency = this.calculatePercentile(sortedLatencies, 95);
    const p99Latency = this.calculatePercentile(sortedLatencies, 99);

    // Calculate throughput (requests per second)
    const timeSpanMs = Date.now() - cutoffTime.getTime();
    const throughput = timeSpanMs > 0 ? (totalRequests / (timeSpanMs / 1000)) : 0;

    return {
      service,
      timestamp: now,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatency,
      p50Latency,
      p95Latency,
      p99Latency,
      errorRate,
      throughput
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private getEmptyMetrics(service: string, timestamp: string): ServiceMetrics {
    return {
      service,
      timestamp,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      errorRate: 0,
      throughput: 0
    };
  }

  public getCachedMetrics(service: string, timeWindow: string = '5m'): ServiceMetrics | undefined {
    const cacheKey = `${service}:${timeWindow}`;
    return this.metricsCache.get(cacheKey);
  }

  public getAllCachedMetrics(): Map<string, ServiceMetrics> {
    return new Map(this.metricsCache);
  }

  public setCachedMetrics(service: string, metrics: ServiceMetrics, timeWindow: string = '5m'): void {
    const cacheKey = `${service}:${timeWindow}`;
    this.metricsCache.set(cacheKey, metrics);
  }

  /**
   * Parse time window string to milliseconds
   * Supports: '1m', '5m', '15m', '1h'
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([mh])$/);
    if (!match) {
      logger.warn(`⚠️ Invalid time window format: ${timeWindow}, defaulting to 5m`);
      return 5 * 60 * 1000; // Default to 5 minutes
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'm') {
      return value * 60 * 1000;
    } else if (unit === 'h') {
      return value * 60 * 60 * 1000;
    }

    return 5 * 60 * 1000; // Default to 5 minutes
  }

  public clearCache(): void {
    this.metricsCache.clear();
    logger.info('📊 Metrics cache cleared');
  }
}

export const metricsCalculator = new MetricsCalculator();




