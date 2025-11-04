import { EachMessagePayload } from 'kafkajs';
import logger from '../../utils/logger';
import { CortexEvent } from '../../api/shared/types/event';
import { MetricsCalculator } from './metricsCalculator';
import { HealthScorer } from './healthScorer';
import { Aggregator } from './aggregator';

export class AnalyticsConsumer {
  private metricsCalculator: MetricsCalculator;
  private healthScorer: HealthScorer;
  private aggregator: Aggregator;
  private batchSize: number = 100;
  private batchTimeout: number = 5000; // 5 seconds
  private eventBatch: CortexEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.metricsCalculator = new MetricsCalculator();
    this.healthScorer = new HealthScorer();
    this.aggregator = new Aggregator();
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
      // Process batch: calculate metrics, health scores, and aggregations
      await Promise.allSettled([
        this.calculateMetrics(batch),
        this.calculateHealthScores(batch),
        this.processAggregations(batch),
      ]);

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
      const serviceGroups = this.groupEventsByService(events);
      
      for (const [service, serviceEvents] of serviceGroups) {
        const metrics = await this.metricsCalculator.calculateServiceMetrics(service, serviceEvents);
        logger.info(`📈 Calculated metrics for service ${service}: ${JSON.stringify(metrics)}`);
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




