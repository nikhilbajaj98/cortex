import { CortexEvent } from '../../api/shared/types/event';
import logger from '../../utils/logger';

export interface HealthScore {
  service: string;
  timestamp: string;
  overallScore: number; // 0-100
  latencyScore: number; // 0-100
  errorRateScore: number; // 0-100
  throughputScore: number; // 0-100
  availabilityScore: number; // 0-100
  status: 'healthy' | 'warning' | 'critical';
  indicators: HealthIndicator[];
}

export interface HealthIndicator {
  name: string;
  value: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  weight: number; // 0-1, importance in overall score
}

export class HealthScorer {
  private healthCache: Map<string, HealthScore> = new Map();
  
  // Health thresholds
  private readonly thresholds = {
    latency: {
      good: 100,    // ms
      warning: 500, // ms
      critical: 1000 // ms
    },
    errorRate: {
      good: 1,      // %
      warning: 5,   // %
      critical: 10  // %
    },
    throughput: {
      good: 100,    // requests/min
      warning: 50,  // requests/min
      critical: 10  // requests/min
    },
    availability: {
      good: 99.9,   // %
      warning: 99,  // %
      critical: 95  // %
    }
  };

  constructor() {
    logger.info('HealthScorer initialized');
  }

  public async calculateHealthScore(service: string, events: CortexEvent[]): Promise<HealthScore> {
    try {
      const healthScore = this.computeHealthScore(service, events);
      
      // Cache the health score
      this.healthCache.set(service, healthScore);
      
      return healthScore;
    } catch (error) {
      logger.error(`❌ Error calculating health score for service ${service}: ${error}`);
      throw error;
    }
  }

  private computeHealthScore(service: string, events: CortexEvent[]): HealthScore {
    const now = new Date().toISOString();
    
    if (events.length === 0) {
      return this.getUnknownHealthScore(service, now);
    }

    // Calculate individual health indicators
    const latencyScore = this.calculateLatencyScore(events);
    const errorRateScore = this.calculateErrorRateScore(events);
    const throughputScore = this.calculateThroughputScore(events);
    const availabilityScore = this.calculateAvailabilityScore(events);

    // Create health indicators
    const indicators: HealthIndicator[] = [
      {
        name: 'latency',
        value: this.getAverageLatency(events),
        threshold: this.thresholds.latency.good,
        status: this.getLatencyStatus(this.getAverageLatency(events)),
        weight: 0.3
      },
      {
        name: 'error_rate',
        value: this.getErrorRate(events),
        threshold: this.thresholds.errorRate.good,
        status: this.getErrorRateStatus(this.getErrorRate(events)),
        weight: 0.3
      },
      {
        name: 'throughput',
        value: this.getThroughput(events),
        threshold: this.thresholds.throughput.good,
        status: this.getThroughputStatus(this.getThroughput(events)),
        weight: 0.2
      },
      {
        name: 'availability',
        value: this.getAvailability(events),
        threshold: this.thresholds.availability.good,
        status: this.getAvailabilityStatus(this.getAvailability(events)),
        weight: 0.2
      }
    ];

    // Calculate weighted overall score
    const overallScore = this.calculateWeightedScore(indicators);
    
    // Determine overall status
    const status = this.determineOverallStatus(overallScore, indicators);

    return {
      service,
      timestamp: now,
      overallScore,
      latencyScore,
      errorRateScore,
      throughputScore,
      availabilityScore,
      status,
      indicators
    };
  }

  private calculateLatencyScore(events: CortexEvent[]): number {
    const avgLatency = this.getAverageLatency(events);
    
    if (avgLatency <= this.thresholds.latency.good) return 100;
    if (avgLatency <= this.thresholds.latency.warning) {
      return 100 - ((avgLatency - this.thresholds.latency.good) / 
                   (this.thresholds.latency.warning - this.thresholds.latency.good)) * 50;
    }
    if (avgLatency <= this.thresholds.latency.critical) {
      return 50 - ((avgLatency - this.thresholds.latency.warning) / 
                  (this.thresholds.latency.critical - this.thresholds.latency.warning)) * 50;
    }
    return 0;
  }

  private calculateErrorRateScore(events: CortexEvent[]): number {
    const errorRate = this.getErrorRate(events);
    
    if (errorRate <= this.thresholds.errorRate.good) return 100;
    if (errorRate <= this.thresholds.errorRate.warning) {
      return 100 - ((errorRate - this.thresholds.errorRate.good) / 
                   (this.thresholds.errorRate.warning - this.thresholds.errorRate.good)) * 50;
    }
    if (errorRate <= this.thresholds.errorRate.critical) {
      return 50 - ((errorRate - this.thresholds.errorRate.warning) / 
                  (this.thresholds.errorRate.critical - this.thresholds.errorRate.warning)) * 50;
    }
    return 0;
  }

  private calculateThroughputScore(events: CortexEvent[]): number {
    const throughput = this.getThroughput(events);
    
    if (throughput >= this.thresholds.throughput.good) return 100;
    if (throughput >= this.thresholds.throughput.warning) {
      return 100 - ((this.thresholds.throughput.good - throughput) / 
                   (this.thresholds.throughput.good - this.thresholds.throughput.warning)) * 50;
    }
    if (throughput >= this.thresholds.throughput.critical) {
      return 50 - ((this.thresholds.throughput.warning - throughput) / 
                  (this.thresholds.throughput.warning - this.thresholds.throughput.critical)) * 50;
    }
    return 0;
  }

  private calculateAvailabilityScore(events: CortexEvent[]): number {
    const availability = this.getAvailability(events);
    
    if (availability >= this.thresholds.availability.good) return 100;
    if (availability >= this.thresholds.availability.warning) {
      return 100 - ((this.thresholds.availability.good - availability) / 
                   (this.thresholds.availability.good - this.thresholds.availability.warning)) * 50;
    }
    if (availability >= this.thresholds.availability.critical) {
      return 50 - ((this.thresholds.availability.warning - availability) / 
                  (this.thresholds.availability.warning - this.thresholds.availability.critical)) * 50;
    }
    return 0;
  }

  private calculateWeightedScore(indicators: HealthIndicator[]): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const indicator of indicators) {
      const score = this.indicatorToScore(indicator);
      weightedSum += score * indicator.weight;
      totalWeight += indicator.weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private indicatorToScore(indicator: HealthIndicator): number {
    switch (indicator.status) {
      case 'good': return 100;
      case 'warning': return 60;
      case 'critical': return 20;
      default: return 0;
    }
  }

  private determineOverallStatus(overallScore: number, indicators: HealthIndicator[]): 'healthy' | 'warning' | 'critical' {
    // Check if any critical indicators
    const hasCritical = indicators.some(ind => ind.status === 'critical');
    if (hasCritical) return 'critical';

    // Check overall score
    if (overallScore >= 80) return 'healthy';
    if (overallScore >= 60) return 'warning';
    return 'critical';
  }

  // Helper methods for calculating metrics
  private getAverageLatency(events: CortexEvent[]): number {
    const latencies = events.map(e => e.latency).filter(l => l > 0);
    return latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  }

  private getErrorRate(events: CortexEvent[]): number {
    const total = events.length;
    const errors = events.filter(e => e.status >= 400).length;
    return total > 0 ? (errors / total) * 100 : 0;
  }

  private getThroughput(events: CortexEvent[]): number {
    // Calculate requests per minute
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const cutoffTime = new Date(Date.now() - timeWindow);
    const recentEvents = events.filter(e => new Date(e.timestamp) > cutoffTime);
    return recentEvents.length;
  }

  private getAvailability(events: CortexEvent[]): number {
    const total = events.length;
    const successful = events.filter(e => e.status >= 200 && e.status < 400).length;
    return total > 0 ? (successful / total) * 100 : 100;
  }

  // Status determination methods
  private getLatencyStatus(latency: number): 'good' | 'warning' | 'critical' {
    if (latency <= this.thresholds.latency.good) return 'good';
    if (latency <= this.thresholds.latency.warning) return 'warning';
    return 'critical';
  }

  private getErrorRateStatus(errorRate: number): 'good' | 'warning' | 'critical' {
    if (errorRate <= this.thresholds.errorRate.good) return 'good';
    if (errorRate <= this.thresholds.errorRate.warning) return 'warning';
    return 'critical';
  }

  private getThroughputStatus(throughput: number): 'good' | 'warning' | 'critical' {
    if (throughput >= this.thresholds.throughput.good) return 'good';
    if (throughput >= this.thresholds.throughput.warning) return 'warning';
    return 'critical';
  }

  private getAvailabilityStatus(availability: number): 'good' | 'warning' | 'critical' {
    if (availability >= this.thresholds.availability.good) return 'good';
    if (availability >= this.thresholds.availability.warning) return 'warning';
    return 'critical';
  }

  private getUnknownHealthScore(service: string, timestamp: string): HealthScore {
    return {
      service,
      timestamp,
      overallScore: 0,
      latencyScore: 0,
      errorRateScore: 0,
      throughputScore: 0,
      availabilityScore: 0,
      status: 'critical',
      indicators: []
    };
  }

  public getCachedHealthScore(service: string): HealthScore | undefined {
    return this.healthCache.get(service);
  }

  public getAllCachedHealthScores(): Map<string, HealthScore> {
    return new Map(this.healthCache);
  }

  public clearCache(): void {
    this.healthCache.clear();
    logger.info('🏥 Health score cache cleared');
  }
}

export const healthScorer = new HealthScorer();






