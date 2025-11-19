import { anomalyDetector } from '../analytics/anomalyDetector';
import { healthScorer } from '../analytics/healthScorer';
import { metricsCalculator } from '../analytics/metricsCalculator';
import { analyticsRepository } from '../analytics/repositories/analyticsRepository';
import logger from '../../utils/logger';

export type DecisionType = 
  | 'SCALE_UP'
  | 'SCALE_DOWN'
  | 'RESTART_PODS'
  | 'CIRCUIT_BREAK'
  | 'NO_ACTION';

export interface ControlPlaneDecision {
  serviceName: string;
  decisionType: DecisionType;
  confidence: number; // 0-100
  metrics: {
    p95Latency: number;
    errorRate: number;
    healthScore: number;
    throughput: number;
  };
  action: {
    description: string;
    currentPods?: number;
    targetPods?: number;
    estimatedRecoveryTime?: number; // seconds
  };
  reasoning: string[];
  timestamp: string;
}

class ControlPlaneSimulator {
  /**
   * Generate a control plane decision for a service
   */
  async generateDecision(serviceName: string, timeWindow: string = '5m'): Promise<ControlPlaneDecision | null> {
    try {
      // Get current metrics from repository (uses ClickHouse)
      const metrics = await analyticsRepository.getServiceMetrics(serviceName, timeWindow);
      if (!metrics) {
        return null;
      }

      // Calculate health score from metrics (simple calculation)
      const healthScore = this.calculateHealthScoreFromMetrics(metrics);

      // Check for anomalies (anomalyDetector.evaluate expects: service, p95LatencyMs, errorRatePct)
      const anomalies = anomalyDetector.evaluate(
        serviceName,
        metrics.p95Latency,
        metrics.errorRate * 100 // Convert to percentage
      );

      // Determine decision based on metrics and anomalies
      const decision = this.makeDecision(serviceName, metrics, healthScore, anomalies);

      return {
        serviceName,
        decisionType: decision.type,
        confidence: decision.confidence,
        metrics: {
          p95Latency: metrics.p95Latency,
          errorRate: metrics.errorRate,
          healthScore: healthScore.overallScore,
          throughput: metrics.throughput,
        },
        action: decision.action,
        reasoning: decision.reasoning,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`❌ Error generating control plane decision: ${error}`);
      return null;
    }
  }

  /**
   * Calculate health score from metrics (simplified version)
   */
  private calculateHealthScoreFromMetrics(metrics: any): { overallScore: number } {
    // Simple health score calculation based on latency and error rate
    let latencyScore = 100;
    if (metrics.p95Latency > 100) {
      latencyScore = Math.max(0, 100 - ((metrics.p95Latency - 100) / 10));
    }

    let errorRateScore = 100;
    const errorRatePct = metrics.errorRate * 100;
    if (errorRatePct > 1) {
      errorRateScore = Math.max(0, 100 - (errorRatePct - 1) * 10);
    }

    const overallScore = (latencyScore * 0.5) + (errorRateScore * 0.5);
    return { overallScore: Math.round(overallScore) };
  }

  /**
   * Make a decision based on metrics, health score, and anomalies
   */
  private makeDecision(
    serviceName: string,
    metrics: any,
    healthScore: { overallScore: number },
    anomalies: any
  ): {
    type: DecisionType;
    confidence: number;
    action: ControlPlaneDecision['action'];
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let confidence = 50; // Base confidence

    // Check error rate first (highest priority)
    if (metrics.errorRate > 0.1) { // >10% error rate
      reasoning.push(`High error rate detected: ${(metrics.errorRate * 100).toFixed(1)}%`);
      
      if (metrics.errorRate > 0.2) { // >20% - circuit break
        confidence = 90;
        return {
          type: 'CIRCUIT_BREAK',
          confidence,
          action: {
            description: 'Enable circuit breaker to prevent cascading failures',
            estimatedRecoveryTime: 300, // 5 minutes
          },
          reasoning: [...reasoning, 'Error rate exceeds 20% threshold'],
        };
      } else { // 10-20% - restart pods
        confidence = 80;
        return {
          type: 'RESTART_PODS',
          confidence,
          action: {
            description: 'Restart unhealthy pods to recover from errors',
            currentPods: 3,
            targetPods: 3,
            estimatedRecoveryTime: 120, // 2 minutes
          },
          reasoning: [...reasoning, 'Error rate between 10-20%'],
        };
      }
    }

    // Check latency
    if (metrics.p95Latency > 500) { // >500ms
      reasoning.push(`High latency detected: ${metrics.p95Latency.toFixed(0)}ms (p95)`);
      
      if (healthScore.overallScore < 50) {
        confidence = 85;
        return {
          type: 'SCALE_UP',
          confidence,
          action: {
            description: 'Scale up pods to handle increased latency',
            currentPods: 3,
            targetPods: 5,
            estimatedRecoveryTime: 180, // 3 minutes
          },
          reasoning: [...reasoning, 'Health score below 50', 'Latency exceeds 500ms threshold'],
        };
      }
    } else if (metrics.p95Latency > 200) { // 200-500ms
      reasoning.push(`Elevated latency: ${metrics.p95Latency.toFixed(0)}ms (p95)`);
      
      if (healthScore.overallScore < 70) {
        confidence = 75;
        return {
          type: 'SCALE_UP',
          confidence,
          action: {
            description: 'Scale up pods to improve latency',
            currentPods: 3,
            targetPods: 4,
            estimatedRecoveryTime: 120, // 2 minutes
          },
          reasoning: [...reasoning, 'Health score below 70', 'Latency between 200-500ms'],
        };
      }
    }

    // Check for low traffic (scale down opportunity)
    if (metrics.throughput < 10 && healthScore.overallScore > 80 && metrics.p95Latency < 100) {
      reasoning.push(`Low traffic detected: ${metrics.throughput.toFixed(1)} req/min`);
      confidence = 60;
      return {
        type: 'SCALE_DOWN',
        confidence,
        action: {
          description: 'Scale down pods to optimize costs',
          currentPods: 3,
          targetPods: 2,
          estimatedRecoveryTime: 60, // 1 minute
        },
        reasoning: [...reasoning, 'Low traffic with healthy metrics', 'Cost optimization opportunity'],
      };
    }

    // Check anomalies
    if (anomalies && anomalies.length > 0) {
      const latencyAnomaly = anomalies.find((a: any) => a.metric === 'p95_latency');
      const errorAnomaly = anomalies.find((a: any) => a.metric === 'error_rate');

      if (errorAnomaly) {
        reasoning.push(`Error rate anomaly detected (z-score: ${errorAnomaly.zScore?.toFixed(2)})`);
        confidence = 80;
        return {
          type: 'RESTART_PODS',
          confidence,
          action: {
            description: 'Restart pods due to error rate anomaly',
            currentPods: 3,
            targetPods: 3,
            estimatedRecoveryTime: 120,
          },
          reasoning: [...reasoning, 'Anomaly detected in error rate'],
        };
      }

      if (latencyAnomaly && metrics.p95Latency > 200) {
        reasoning.push(`Latency anomaly detected (z-score: ${latencyAnomaly.zScore?.toFixed(2)})`);
        confidence = 75;
        return {
          type: 'SCALE_UP',
          confidence,
          action: {
            description: 'Scale up pods due to latency anomaly',
            currentPods: 3,
            targetPods: 5,
            estimatedRecoveryTime: 180,
          },
          reasoning: [...reasoning, 'Anomaly detected in latency'],
        };
      }
    }

    // Default: no action needed
    reasoning.push('All metrics within acceptable ranges');
    return {
      type: 'NO_ACTION',
      confidence: 70,
      action: {
        description: 'Continue monitoring - no action required',
      },
      reasoning: [...reasoning, 'Service is healthy'],
    };
  }

  /**
   * Get decisions for all active services
   */
  async getAllDecisions(timeWindow: string = '5m'): Promise<ControlPlaneDecision[]> {
    try {
      // Convert timeWindow to hours (5m = 0.083 hours, 15m = 0.25 hours, 1h = 1 hour)
      const hoursMap: Record<string, number> = {
        '1m': 1/60,
        '5m': 5/60,
        '15m': 15/60,
        '1h': 1,
        '24h': 24,
      };
      const hours = hoursMap[timeWindow] || 1; // Default to 1 hour
      
      // Get list of active services
      const services = await analyticsRepository.getActiveServices(hours);
      
      const decisions: ControlPlaneDecision[] = [];
      
      for (const serviceName of services) {
        const decision = await this.generateDecision(serviceName, timeWindow);
        if (decision) {
          decisions.push(decision);
        }
      }

      return decisions;
    } catch (error) {
      logger.error(`❌ Error getting all decisions: ${error}`);
      return [];
    }
  }
}

export const controlPlaneSimulator = new ControlPlaneSimulator();

