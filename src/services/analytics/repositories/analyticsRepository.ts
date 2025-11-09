import { CortexEvent } from '../../../api/shared/types/event';
import { ServiceMetrics } from '../metricsCalculator';
import { clickHouseRepository, TimeSeriesDataPoint } from './clickHouseRepository';
import logger from '../../../utils/logger';

/**
 * Analytics Repository - High-level abstraction for analytics storage
 * Currently uses ClickHouse as the backend, but can be swapped out
 */
export interface IAnalyticsRepository {
  persistEvents(events: CortexEvent[], source?: 'kong' | 'direct'): Promise<void>;
  getServiceMetrics(service: string, timeWindow?: string): Promise<ServiceMetrics | null>;
  getTimeSeries(service: string, start: Date, end: Date, granularity?: '1m' | '5m' | '15m' | '1h'): Promise<TimeSeriesDataPoint[]>;
  getActiveServices(hours?: number): Promise<string[]>;
}

export class AnalyticsRepository implements IAnalyticsRepository {
  /**
   * Persist events to ClickHouse
   */
  async persistEvents(events: CortexEvent[], source: 'kong' | 'direct' = 'direct'): Promise<void> {
    try {
      await clickHouseRepository.insertEvents(events, source);
      logger.debug(`✅ Persisted ${events.length} events to ClickHouse`);
    } catch (error: any) {
      logger.error(`❌ Failed to persist events to ClickHouse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get service metrics from ClickHouse (with fallback to cache if needed)
   */
  async getServiceMetrics(service: string, timeWindow: string = '5m'): Promise<ServiceMetrics | null> {
    try {
      const metrics = await clickHouseRepository.queryServiceMetrics(service, timeWindow);
      return metrics;
    } catch (error: any) {
      logger.error(`❌ Failed to get service metrics from ClickHouse: ${error.message}`);
      // Don't throw - return null to allow fallback to cache
      return null;
    }
  }

  /**
   * Get time series data for a service
   */
  async getTimeSeries(
    service: string,
    start: Date,
    end: Date,
    granularity: '1m' | '5m' | '15m' | '1h' = '5m'
  ): Promise<TimeSeriesDataPoint[]> {
    try {
      return await clickHouseRepository.queryTimeSeries(service, start, end, granularity);
    } catch (error: any) {
      logger.error(`❌ Failed to get time series from ClickHouse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get list of active services
   */
  async getActiveServices(hours: number = 24): Promise<string[]> {
    try {
      return await clickHouseRepository.getActiveServices(hours);
    } catch (error: any) {
      logger.error(`❌ Failed to get active services from ClickHouse: ${error.message}`);
      return [];
    }
  }
}

export const analyticsRepository = new AnalyticsRepository();




