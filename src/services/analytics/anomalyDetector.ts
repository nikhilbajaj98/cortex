import logger from '../../utils/logger';

export type Anomaly = {
  service: string;
  metric: 'p95_latency' | 'error_rate';
  value: number;
  baseline: number;
  zScore: number;
  threshold: number;
  timestamp: string;
};

class RollingStats {
  private count = 0;
  private mean = 0;
  private m2 = 0;

  update(value: number) {
    this.count += 1;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  getMean() {
    return this.mean;
  }

  getStd() {
    return this.count > 1 ? Math.sqrt(this.m2 / (this.count - 1)) : 0;
  }
}

class AnomalyDetector {
  private latencyStats: Map<string, RollingStats> = new Map();
  private errorRateStats: Map<string, RollingStats> = new Map();
  private currentAnomalies: Map<string, Anomaly> = new Map();

  private getStats(map: Map<string, RollingStats>, key: string) {
    const s = map.get(key) || new RollingStats();
    map.set(key, s);
    return s;
  }

  evaluate(service: string, p95LatencyMs: number, errorRatePct: number) {
    const now = new Date().toISOString();

    // Latency
    const latStats = this.getStats(this.latencyStats, service);
    const latMean = latStats.getMean();
    const latStd = latStats.getStd();
    const latZ = latStd === 0 ? 0 : (p95LatencyMs - latMean) / latStd;

    // Error rate
    const errStats = this.getStats(this.errorRateStats, service);
    const errMean = errStats.getMean();
    const errStd = errStats.getStd();
    const errZ = errStd === 0 ? 0 : (errorRatePct - errMean) / errStd;

    const anomalies: Anomaly[] = [];
    const latencyThreshold = 3.0;
    const errorThreshold = 3.0;

    if (latStd > 0 && latZ >= latencyThreshold) {
      anomalies.push({
        service,
        metric: 'p95_latency',
        value: p95LatencyMs,
        baseline: latMean,
        zScore: latZ,
        threshold: latencyThreshold,
        timestamp: now,
      });
    }
    if (errStd > 0 && errZ >= errorThreshold) {
      anomalies.push({
        service,
        metric: 'error_rate',
        value: errorRatePct,
        baseline: errMean,
        zScore: errZ,
        threshold: errorThreshold,
        timestamp: now,
      });
    }

    if (anomalies.length > 0) {
      // keep the worst anomaly (max z-score)
      const top = anomalies.sort((a, b) => b.zScore - a.zScore)[0];
      this.currentAnomalies.set(service, top);
      logger.warn(`🚨 Anomaly detected for ${service}: ${top.metric} z=${top.zScore.toFixed(2)} value=${top.value} baseline=${top.baseline.toFixed(2)}`);
    } else {
      // Clear anomaly when values return to normal (within 1 stddev)
      const existing = this.currentAnomalies.get(service);
      if (existing) {
        const cleared = (existing.metric === 'p95_latency' ? Math.abs(latZ) < 1 : Math.abs(errZ) < 1);
        if (cleared) {
          this.currentAnomalies.delete(service);
          logger.info(`✅ Anomaly cleared for ${service}`);
        }
      }
    }

    // Always update stats after evaluation to avoid immediate dilution
    latStats.update(p95LatencyMs);
    errStats.update(errorRatePct);
  }

  getAll(): Anomaly[] {
    return Array.from(this.currentAnomalies.values());
  }

  getForService(service: string): Anomaly | null {
    return this.currentAnomalies.get(service) || null;
  }
}

export const anomalyDetector = new AnomalyDetector();



