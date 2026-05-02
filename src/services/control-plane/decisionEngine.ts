import logger from '../../utils/logger';
import { anomalyDetector } from '../analytics/anomalyDetector';
import { analyticsRepository } from '../analytics/repositories/analyticsRepository';
import { ControlPlaneDecision, DecisionType } from './types';
import { ServiceMetrics } from '../analytics/metricsCalculator';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseTimeWindowToMinutes(timeWindow: string): number {
  const m = timeWindow.match(/^(\d+)([mh])$/);
  if (!m) return 5;
  const value = Number(m[1]);
  const unit = m[2];
  return unit === 'h' ? value * 60 : value;
}

function healthScoreFromMetrics(metrics: ServiceMetrics): number {
  // Simple and explainable health model (0..100):
  // - penalize latency (p95)
  // - penalize errors (errorRate pct)
  const p95 = metrics.p95Latency || 0;
  const errPct = metrics.errorRate || 0; // ClickHouse returns percent 0..100

  let latencyScore = 100;
  if (p95 > 100) latencyScore = clamp(100 - (p95 - 100) / 10, 0, 100);

  let errorScore = 100;
  if (errPct > 1) errorScore = clamp(100 - (errPct - 1) * 10, 0, 100);

  return Math.round(latencyScore * 0.55 + errorScore * 0.45);
}

export class DecisionEngine {
  async evaluateService(serviceName: string, timeWindow: string = '5m'): Promise<ControlPlaneDecision | null> {
    const metrics = await analyticsRepository.getServiceMetrics(serviceName, timeWindow);
    if (!metrics) return null;

    const healthScore = healthScoreFromMetrics(metrics);
    const anomaly = anomalyDetector.getForService(serviceName);

    const { type, confidence, action, reasoning } = this.makeDecision(serviceName, metrics, healthScore, anomaly);

    // UI compatibility:
    // - decision.metrics.errorRate is a fraction 0..1
    // - decision.metrics.throughput is requests/min
    const errorRateFraction = clamp((metrics.errorRate || 0) / 100, 0, 1);
    const throughputPerMin = (metrics.throughput || 0) * 60;

    return {
      serviceName,
      decisionType: type,
      confidence,
      metrics: {
        p95Latency: metrics.p95Latency,
        errorRate: errorRateFraction,
        healthScore,
        throughput: throughputPerMin,
      },
      action,
      reasoning,
      timestamp: new Date().toISOString(),
    };
  }

  async evaluateAll(timeWindow: string = '5m'): Promise<ControlPlaneDecision[]> {
    const minutes = parseTimeWindowToMinutes(timeWindow);
    const activeHours = Math.max(1 / 60, minutes / 60); // ensure non-zero
    const services = await analyticsRepository.getActiveServices(activeHours);

    const decisions = await Promise.all(
      services.map((s) => this.evaluateService(s, timeWindow).catch((err) => {
        logger.warn(`⚠️ DecisionEngine failed for service=${s}: ${err?.message || err}`);
        return null;
      }))
    );

    return decisions.filter(Boolean) as ControlPlaneDecision[];
  }

  private makeDecision(
    serviceName: string,
    metrics: ServiceMetrics,
    healthScore: number,
    anomaly: any | null,
  ): {
    type: DecisionType;
    confidence: number;
    action: ControlPlaneDecision['action'];
    reasoning: string[];
  } {
    const reasoning: string[] = [];

    const errPct = metrics.errorRate || 0; // percent
    const p95 = metrics.p95Latency || 0;

    // Error-driven decisions (highest priority)
    if (errPct >= 20) {
      reasoning.push(`High error rate: ${errPct.toFixed(1)}% (>= 20%)`);
      return {
        type: 'CIRCUIT_BREAK',
        confidence: 92,
        action: {
          description: 'Enable circuit breaker to prevent cascading failures',
          estimatedRecoveryTime: 300,
          dryRun: true,
        },
        reasoning,
      };
    }

    if (errPct >= 10) {
      reasoning.push(`Elevated error rate: ${errPct.toFixed(1)}% (>= 10%)`);
      return {
        type: 'RESTART_PODS',
        confidence: 85,
        action: {
          description: 'Restart pods to recover from sustained errors',
          currentPods: 3,
          targetPods: 3,
          estimatedRecoveryTime: 120,
          dryRun: true,
        },
        reasoning,
      };
    }

    // Latency-driven decisions
    if (p95 >= 800) {
      reasoning.push(`Very high p95 latency: ${p95.toFixed(0)}ms (>= 800ms)`);
      return {
        type: 'SCALE_UP',
        confidence: 86,
        action: {
          description: 'Scale up pods to reduce tail latency',
          currentPods: 3,
          targetPods: 6,
          estimatedRecoveryTime: 240,
          dryRun: true,
        },
        reasoning,
      };
    }

    if (p95 >= 400 && healthScore < 70) {
      reasoning.push(`High p95 latency: ${p95.toFixed(0)}ms (>= 400ms)`);
      reasoning.push(`Health score degraded: ${healthScore}/100 (< 70)`);
      return {
        type: 'SCALE_UP',
        confidence: 78,
        action: {
          description: 'Scale up pods to improve latency under load',
          currentPods: 3,
          targetPods: 4,
          estimatedRecoveryTime: 180,
          dryRun: true,
        },
        reasoning,
      };
    }

    // Anomaly-driven decisions (if analytics pipeline flagged one)
    if (anomaly) {
      reasoning.push(`Anomaly detected: ${anomaly.metric} z=${Number(anomaly.zScore).toFixed(2)}`);
      if (anomaly.metric === 'error_rate') {
        return {
          type: 'RESTART_PODS',
          confidence: 80,
          action: {
            description: 'Restart pods due to error-rate anomaly',
            currentPods: 3,
            targetPods: 3,
            estimatedRecoveryTime: 120,
            dryRun: true,
          },
          reasoning,
        };
      }
      if (anomaly.metric === 'p95_latency' && p95 >= 250) {
        return {
          type: 'SCALE_UP',
          confidence: 76,
          action: {
            description: 'Scale up pods due to latency anomaly',
            currentPods: 3,
            targetPods: 5,
            estimatedRecoveryTime: 180,
            dryRun: true,
          },
          reasoning,
        };
      }
    }

    // Default: no action
    reasoning.push('No action required; metrics within thresholds');
    return {
      type: 'NO_ACTION',
      confidence: 70,
      action: {
        description: 'Continue monitoring - no action required',
        dryRun: true,
      },
      reasoning,
    };
  }
}

export const decisionEngine = new DecisionEngine();

