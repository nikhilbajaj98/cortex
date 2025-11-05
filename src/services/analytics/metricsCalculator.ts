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

  public async calculateServiceMetrics(service: string, events: CortexEvent[]): Promise<ServiceMetrics> {
    try {
      const metrics = this.computeMetrics(service, events);
      
      // Cache the metrics
      this.metricsCache.set(service, metrics);
      
      return metrics;
    } catch (error) {
      logger.error(`❌ Error calculating metrics for service ${service}: ${error}`);
      throw error;
    }
  }

  private computeMetrics(service: string, events: CortexEvent[]): ServiceMetrics {
    const now = new Date().toISOString();
    
    // Filter events for the last time window (e.g., last 5 minutes)
    const timeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
    const cutoffTime = new Date(Date.now() - timeWindow);
    
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

  public getCachedMetrics(service: string): ServiceMetrics | undefined {
    return this.metricsCache.get(service);
  }

  public getAllCachedMetrics(): Map<string, ServiceMetrics> {
    return new Map(this.metricsCache);
  }

  public setCachedMetrics(service: string, metrics: ServiceMetrics): void {
    this.metricsCache.set(service, metrics);
  }

  public clearCache(): void {
    this.metricsCache.clear();
    logger.info('📊 Metrics cache cleared');
  }
}

export const metricsCalculator = new MetricsCalculator();




