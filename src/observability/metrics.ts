import { clickHouseClient } from '../infrastructure/connections/clickhouse';

type Counter = { name: string; help: string; value: number };
type Gauge = { name: string; help: string; value: number };

class InProcessMetricsRegistry {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();

  incCounter(name: string, help: string, amount: number = 1) {
    const c = this.counters.get(name) || { name, help, value: 0 };
    c.value += amount;
    this.counters.set(name, c);
  }

  setGauge(name: string, help: string, value: number) {
    const g = this.gauges.get(name) || { name, help, value: 0 };
    g.value = value;
    this.gauges.set(name, g);
  }

  async updateClickHouseHealthGauge() {
    try {
      const health = await clickHouseClient.healthCheck();
      this.setGauge('cortex_clickhouse_healthy', 'ClickHouse health status (1 healthy, 0 unhealthy)', health.healthy ? 1 : 0);
    } catch {
      this.setGauge('cortex_clickhouse_healthy', 'ClickHouse health status (1 healthy, 0 unhealthy)', 0);
    }
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const c of this.counters.values()) {
      lines.push(`# HELP ${c.name} ${c.help}`);
      lines.push(`# TYPE ${c.name} counter`);
      lines.push(`${c.name} ${c.value}`);
    }
    for (const g of this.gauges.values()) {
      lines.push(`# HELP ${g.name} ${g.help}`);
      lines.push(`# TYPE ${g.name} gauge`);
      lines.push(`${g.name} ${g.value}`);
    }
    return lines.join('\n') + '\n';
  }
}

export const metricsRegistry = new InProcessMetricsRegistry();

// Commonly used counters
export const METRIC_COUNTERS = {
  batchesProcessed: { name: 'cortex_batches_processed_total', help: 'Total analytics batches processed' },
  batchesPersistFailed: { name: 'cortex_batches_persist_failed_total', help: 'Batches where persistence failed after retries' },
  eventsToDlq: { name: 'cortex_events_dlq_total', help: 'Total events sent to DLQ' },
};



