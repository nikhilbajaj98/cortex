import { EachMessagePayload } from 'kafkajs';
import logger from '../../utils/logger';
import { CortexEvent } from '../../api/shared/types/event';
import { metricsCalculator, MetricsCalculator } from './metricsCalculator';
import { healthScorer, HealthScorer } from './healthScorer';
import { aggregator, Aggregator } from './aggregator';
import { analyticsRepository } from './repositories/analyticsRepository';
import { anomalyDetector } from './anomalyDetector';
import { metricsRegistry, METRIC_COUNTERS } from '../../observability/metrics';

export class AnalyticsConsumer {
  private metricsCalculator: MetricsCalculator;
  private healthScorer: HealthScorer;
  private aggregator: Aggregator;
  private batchSize: number = parseInt(process.env.ANALYTICS_BATCH_SIZE || '500'); // Production batch size
  private batchTimeout: number = parseInt(process.env.ANALYTICS_BATCH_TIMEOUT || '250'); // 250ms timeout
  private eventBatch: CortexEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Use shared singletons so API routes can read the same caches
    this.metricsCalculator = metricsCalculator;
    this.healthScorer = healthScorer;
    this.aggregator = aggregator;
    logger.info('AnalyticsConsumer initialized');
  }

  public async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    if (!message.value) {
      logger.warn(`Received null or undefined message value from topic ${topic}. Skipping.`);
      return;
    }

    try {
      const event: CortexEvent = JSON.parse(message.value.toString());
      this.eventBatch.push(event);

      if (this.eventBatch.length >= this.batchSize) {
        await this.processBatch();
      } else {
        this.setBatchTimer();
      }

    } catch (error) {
      logger.error(`❌ Error handling analytics message: ${error}`);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.eventBatch.length === 0) return;

    // Clear any existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batch = [...this.eventBatch];
    this.eventBatch = []; // Clear the batch for new events

    try {
      // Step 1: Persist to ClickHouse first (critical for control plane decisions)
      const persistenceResult = await Promise.allSettled([this.persistEvents(batch)]);
      if (persistenceResult[0].status === 'rejected') {
        logger.warn(`⚠️ Failed to persist events to ClickHouse (continuing): ${persistenceResult[0].reason}`);
        metricsRegistry.incCounter(METRIC_COUNTERS.batchesPersistFailed.name, METRIC_COUNTERS.batchesPersistFailed.help, 1);
      }

      // Step 2: Get unique services from batch for ClickHouse queries
      const services = Array.from(new Set(batch.map(e => e.service)));

      // Step 3: Query ClickHouse for complete metrics (after persistence)
      // This ensures anomaly detector and control plane see complete data, not just batch data
      // Note: ClickHouse materialized views update synchronously, so data should be available immediately
      // If query returns null (no data yet), we'll use batch metrics as fallback
      const clickHouseMetricsPromises = services.map(service => 
        analyticsRepository.getServiceMetrics(service, '5m').catch(err => {
          logger.warn(`⚠️ Failed to query ClickHouse metrics for ${service}: ${err.message}`);
          return null;
        })
      );

      const clickHouseMetrics = await Promise.all(clickHouseMetricsPromises);

      // Step 4: Feed complete metrics to anomaly detector (for control plane decisions)
      for (let i = 0; i < services.length; i++) {
        const service = services[i];
        const completeMetrics = clickHouseMetrics[i];
        
        if (completeMetrics) {
          // Feed complete metrics to anomaly detector (CRITICAL for control plane)
          // This ensures decisions are based on all events in the time window, not just the current batch
          anomalyDetector.evaluate(service, completeMetrics.p95Latency, completeMetrics.errorRate);
          
          // Update in-memory cache with complete metrics (for UI fast path)
          metricsCalculator.setCachedMetrics(service, completeMetrics, '5m');
          
          logger.debug(`✅ Updated metrics for ${service} from ClickHouse: ${completeMetrics.totalRequests} requests, p95: ${completeMetrics.p95Latency}ms`);
        } else {
          // Fallback: If ClickHouse query fails or returns null, use batch metrics
          // This is acceptable for the first batch or if ClickHouse is unavailable
          logger.debug(`⚠️ ClickHouse metrics not available for ${service}, using batch metrics as fallback`);
          const serviceEvents = batch.filter(e => e.service === service);
          if (serviceEvents.length > 0) {
            const batchMetrics = await this.metricsCalculator.calculateServiceMetrics(service, serviceEvents);
            // Only use batch metrics for anomaly detection if ClickHouse is unavailable
            // This ensures we don't miss critical anomalies even during ClickHouse outages
            anomalyDetector.evaluate(service, batchMetrics.p95Latency, batchMetrics.errorRate);
          }
        }
      }

      // Step 5: Calculate in-memory metrics, health scores, and aggregations (for UI/compatibility)
      // Note: These are still useful for UI display, but control plane should use ClickHouse data
      await Promise.allSettled([
        this.calculateMetrics(batch),
        this.calculateHealthScores(batch),
        this.processAggregations(batch),
      ]);

      metricsRegistry.incCounter(METRIC_COUNTERS.batchesProcessed.name, METRIC_COUNTERS.batchesProcessed.help, 1);
      logger.info(`📊 Processed analytics batch of ${batch.length} events`);

    } catch (error) {
      logger.error(`❌ Error processing analytics batch: ${error}`);
    }
  }

  private setBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.batchTimer = setTimeout(() => {
      this.processBatch().catch(error => {
        logger.error(`❌ Error in analytics batch timer processing: ${error}`);
      });
    }, this.batchTimeout);
  }

  private async calculateMetrics(events: CortexEvent[]): Promise<void> {
    try {
      // Group events by service for metrics calculation
      // NOTE: This is for in-memory cache (UI fast path). Control plane should use ClickHouse data.
      const serviceGroups = this.groupEventsByService(events);
      
      for (const [service, serviceEvents] of serviceGroups) {
        const metrics = await this.metricsCalculator.calculateServiceMetrics(service, serviceEvents);
        logger.info(`📈 Calculated metrics for service ${service}: ${JSON.stringify(metrics)}`);

        // Feed anomaly detector with p95 latency and error rate
        if (metrics && typeof metrics.p95Latency === 'number' && typeof metrics.errorRate === 'number') {
          anomalyDetector.evaluate(service, metrics.p95Latency, metrics.errorRate);
        }
      }
    } catch (error) {
      logger.error(`❌ Failed to calculate metrics: ${error}`);
    }
  }

  private async calculateHealthScores(events: CortexEvent[]): Promise<void> {
    try {
      const serviceGroups = this.groupEventsByService(events);
      
      for (const [service, serviceEvents] of serviceGroups) {
        const healthScore = await this.healthScorer.calculateHealthScore(service, serviceEvents);
        logger.info(`🏥 Health score for service ${service}: ${healthScore}`);
      }
    } catch (error) {
      logger.error(`❌ Failed to calculate health scores: ${error}`);
    }
  }

  private async processAggregations(events: CortexEvent[]): Promise<void> {
    try {
      // Process time-based aggregations
      await this.aggregator.processTimeWindowAggregations(events);
      
      // Process service-based aggregations
      await this.aggregator.processServiceAggregations(events);
      
      logger.info(`🔄 Processed aggregations for ${events.length} events`);
    } catch (error) {
      logger.error(`❌ Failed to process aggregations: ${error}`);
    }
  }

  private async persistEvents(events: CortexEvent[]): Promise<void> {
    const source = events[0]?.metadata?.source === 'kong' ? 'kong' : 'direct';

    try {
      // ClickHouse client handles retries internally (with circuit breaker)
      // No need for additional retry logic here to avoid n*m retry multiplication
      await analyticsRepository.persistEvents(events, source);
    } catch (error: any) {
      // If ClickHouse client exhausted all retries, send to DLQ for later replay
      logger.error(`❌ ClickHouse persistence failed after client retries: ${error.message}`);
      
      try {
        const { kafkaProducer } = await import('../messaging/kafkaProducer');
        await kafkaProducer.publishBatch('cortex-events-dlq', events, 'service');
        logger.error(`🚨 Sent ${events.length} events to DLQ: cortex-events-dlq`);
      } catch (dlqErr: any) {
        logger.error(`❌ Failed to send events to DLQ: ${dlqErr.message}`);
      }

      // Re-throw to signal failure (but events are safely in DLQ)
      throw error;
    }
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
}

export const analyticsConsumer = new AnalyticsConsumer();




