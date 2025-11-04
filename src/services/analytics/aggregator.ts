import { CortexEvent } from '../../api/shared/types/event';
import logger from '../../utils/logger';

export interface TimeWindowAggregation {
  window: string; // e.g., '1m', '5m', '1h'
  timestamp: string;
  totalEvents: number;
  uniqueServices: number;
  averageLatency: number;
  errorRate: number;
  topServices: Array<{
    service: string;
    eventCount: number;
    errorRate: number;
  }>;
}

export interface ServiceAggregation {
  service: string;
  timestamp: string;
  timeWindow: string;
  totalEvents: number;
  averageLatency: number;
  errorRate: number;
  latencyDistribution: {
    p50: number;
    p95: number;
    p99: number;
  };
  statusDistribution: Record<string, number>;
}

export class Aggregator {
  private timeWindowCache: Map<string, TimeWindowAggregation> = new Map();
  private serviceCache: Map<string, ServiceAggregation> = new Map();

  constructor() {
    logger.info('Aggregator initialized');
  }

  public async processTimeWindowAggregations(events: CortexEvent[]): Promise<void> {
    try {
      const timeWindows = ['1m', '5m', '15m', '1h'];
      
      for (const window of timeWindows) {
        const aggregation = this.calculateTimeWindowAggregation(events, window);
        this.timeWindowCache.set(window, aggregation);
      }

      logger.info(`🔄 Processed time window aggregations for ${events.length} events`);
    } catch (error) {
      logger.error(`❌ Error processing time window aggregations: ${error}`);
    }
  }

  public async processServiceAggregations(events: CortexEvent[]): Promise<void> {
    try {
      const serviceGroups = this.groupEventsByService(events);
      
      for (const [service, serviceEvents] of serviceGroups) {
        const aggregation = this.calculateServiceAggregation(service, serviceEvents);
        this.serviceCache.set(service, aggregation);
      }

      logger.info(`🔄 Processed service aggregations for ${serviceGroups.size} services`);
    } catch (error) {
      logger.error(`❌ Error processing service aggregations: ${error}`);
    }
  }

  private calculateTimeWindowAggregation(events: CortexEvent[], window: string): TimeWindowAggregation {
    const now = new Date().toISOString();
    const windowMs = this.getWindowMs(window);
    const cutoffTime = new Date(Date.now() - windowMs);
    
    const recentEvents = events.filter(event => 
      new Date(event.timestamp) > cutoffTime
    );

    if (recentEvents.length === 0) {
      return this.getEmptyTimeWindowAggregation(window, now);
    }

    // Calculate basic metrics
    const uniqueServices = new Set(recentEvents.map(e => e.service)).size;
    const averageLatency = this.calculateAverageLatency(recentEvents);
    const errorRate = this.calculateErrorRate(recentEvents);

    // Calculate top services
    const serviceStats = this.calculateServiceStats(recentEvents);
    const topServices = Array.from(serviceStats.entries())
      .map(([service, stats]) => ({
        service,
        eventCount: stats.count,
        errorRate: stats.errorRate
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10); // Top 10 services

    return {
      window,
      timestamp: now,
      totalEvents: recentEvents.length,
      uniqueServices,
      averageLatency,
      errorRate,
      topServices
    };
  }

  private calculateServiceAggregation(service: string, events: CortexEvent[]): ServiceAggregation {
    const now = new Date().toISOString();
    const timeWindow = '5m'; // Default time window

    if (events.length === 0) {
      return this.getEmptyServiceAggregation(service, now, timeWindow);
    }

    const averageLatency = this.calculateAverageLatency(events);
    const errorRate = this.calculateErrorRate(events);
    const latencyDistribution = this.calculateLatencyDistribution(events);
    const statusDistribution = this.calculateStatusDistribution(events);

    return {
      service,
      timestamp: now,
      timeWindow,
      totalEvents: events.length,
      averageLatency,
      errorRate,
      latencyDistribution,
      statusDistribution
    };
  }

  private groupEventsByService(events: CortexEvent[]): Map<string, CortexEvent[]> {
    const groups = new Map<string, CortexEvent[]>();
    
    for (const event of events) {
      const service = event.service;
      if (!groups.has(service)) {
        groups.set(service, []);
      }
      groups.get(service)!.push(event);
    }
    
    return groups;
  }

  private calculateServiceStats(events: CortexEvent[]): Map<string, { count: number; errorRate: number }> {
    const serviceGroups = this.groupEventsByService(events);
    const stats = new Map<string, { count: number; errorRate: number }>();

    for (const [service, serviceEvents] of serviceGroups) {
      const errorRate = this.calculateErrorRate(serviceEvents);
      stats.set(service, {
        count: serviceEvents.length,
        errorRate
      });
    }

    return stats;
  }

  private calculateAverageLatency(events: CortexEvent[]): number {
    const latencies = events.map(e => e.latency).filter(l => l > 0);
    return latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  }

  private calculateErrorRate(events: CortexEvent[]): number {
    const total = events.length;
    const errors = events.filter(e => e.status >= 400).length;
    return total > 0 ? (errors / total) * 100 : 0;
  }

  private calculateLatencyDistribution(events: CortexEvent[]): { p50: number; p95: number; p99: number } {
    const latencies = events.map(e => e.latency).filter(l => l > 0).sort((a, b) => a - b);
    
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    return {
      p50: this.calculatePercentile(latencies, 50),
      p95: this.calculatePercentile(latencies, 95),
      p99: this.calculatePercentile(latencies, 99)
    };
  }

  private calculateStatusDistribution(events: CortexEvent[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const event of events) {
      const status = event.status.toString();
      distribution[status] = (distribution[status] || 0) + 1;
    }

    return distribution;
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private getWindowMs(window: string): number {
    switch (window) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      default: return 5 * 60 * 1000; // Default to 5 minutes
    }
  }

  private getEmptyTimeWindowAggregation(window: string, timestamp: string): TimeWindowAggregation {
    return {
      window,
      timestamp,
      totalEvents: 0,
      uniqueServices: 0,
      averageLatency: 0,
      errorRate: 0,
      topServices: []
    };
  }

  private getEmptyServiceAggregation(service: string, timestamp: string, timeWindow: string): ServiceAggregation {
    return {
      service,
      timestamp,
      timeWindow,
      totalEvents: 0,
      averageLatency: 0,
      errorRate: 0,
      latencyDistribution: { p50: 0, p95: 0, p99: 0 },
      statusDistribution: {}
    };
  }

  public getTimeWindowAggregation(window: string): TimeWindowAggregation | undefined {
    return this.timeWindowCache.get(window);
  }

  public getServiceAggregation(service: string): ServiceAggregation | undefined {
    return this.serviceCache.get(service);
  }

  public getAllTimeWindowAggregations(): Map<string, TimeWindowAggregation> {
    return new Map(this.timeWindowCache);
  }

  public getAllServiceAggregations(): Map<string, ServiceAggregation> {
    return new Map(this.serviceCache);
  }

  public clearCache(): void {
    this.timeWindowCache.clear();
    this.serviceCache.clear();
    logger.info('🔄 Aggregation cache cleared');
  }
}

export const aggregator = new Aggregator();




