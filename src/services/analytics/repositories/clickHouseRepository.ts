import { clickHouseClient } from '../../../infrastructure/connections/clickhouse';
import { CortexEvent } from '../../../api/shared/types/event';
import logger from '../../../utils/logger';
import { ServiceMetrics } from '../metricsCalculator';
import { v4 as uuidv4 } from 'uuid';

export interface ClickHouseEventRow {
  event_id: string;
  tenant_id: string;
  service: string;
  route: string;
  method: string;
  type: string;
  status: number;
  status_code: number;
  source: string;
  latency_ms: number;
  bytes_in: number;
  bytes_out: number;
  ts: string; // DateTime format: 'YYYY-MM-DD HH:mm:ss'
  ingested_at: string;
  request_id: string;
  correlation_id: string;
  error_code: string;
  error_class: string;
  region: string;
  cluster: string;
  env: string;
  user_hash: string;
  metadata: string; // JSON string
}

export interface TimeSeriesDataPoint {
  window_start: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  p50_latency: number;
  p95_latency: number;
  p99_latency: number;
  avg_latency: number;
  error_rate: number;
  throughput: number;
}

export class ClickHouseRepository {
  /**
   * Transform CortexEvent to ClickHouse row format
   */
  private transformEventToRow(event: CortexEvent, source: 'kong' | 'direct' = 'direct'): ClickHouseEventRow {
    // Extract metadata fields
    const metadata = event.metadata || {};
    const route = metadata.path || metadata.route?.name || '';
    const method = metadata.method || '';
    const requestId = metadata.requestId || metadata.request_id || '';
    const correlationId = metadata.correlationId || metadata.correlation_id || '';
    const clientIp = event.ip || metadata.clientIp || 'unknown';
    
    // Generate event_id if not present
    const eventId = metadata.eventId || metadata.event_id || uuidv4();
    
    // Extract error information
    const errorCode = metadata.errorCode || metadata.error_code || '';
    const errorClass = metadata.errorClass || metadata.error_class || '';
    
    // Extract dimensions
    const region = metadata.region || '';
    const cluster = metadata.cluster || '';
    const env = metadata.env || process.env.NODE_ENV || 'production';
    const tenantId = metadata.tenantId || metadata.tenant_id || 'default';
    const userHash = metadata.userHash || metadata.user_hash || '';
    
    // Extract bytes if available
    const bytesIn = metadata.bytesIn || metadata.bytes_in || 0;
    const bytesOut = metadata.bytesOut || metadata.bytes_out || 0;
    
    // Parse timestamp
    const eventTimestamp = new Date(event.timestamp);
    const ts = eventTimestamp.toISOString().replace('T', ' ').substring(0, 19);
    const ingestedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    return {
      event_id: eventId,
      tenant_id: tenantId,
      service: event.service,
      route: route,
      method: method,
      type: event.type,
      status: event.status,
      status_code: event.status,
      source: source,
      latency_ms: event.latency || 0,
      bytes_in: bytesIn,
      bytes_out: bytesOut,
      ts: ts,
      ingested_at: ingestedAt,
      request_id: requestId,
      correlation_id: correlationId,
      error_code: errorCode,
      error_class: errorClass,
      region: region,
      cluster: cluster,
      env: env,
      user_hash: userHash,
      metadata: JSON.stringify(event.metadata || {}),
    };
  }

  /**
   * Insert events batch into ClickHouse
   */
  async insertEvents(events: CortexEvent[], source: 'kong' | 'direct' = 'direct'): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      const rows = events.map(event => this.transformEventToRow(event, source));
      
      // Use batch size of 1000 to avoid overwhelming ClickHouse
      const batchSize = 1000;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await clickHouseClient.insert('events', batch, 'JSONEachRow');
      }
      
      logger.info(`✅ Inserted ${events.length} events into ClickHouse`);
    } catch (error: any) {
      logger.error(`❌ Error inserting events into ClickHouse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Query service metrics from ClickHouse rollup tables
   */
  async queryServiceMetrics(
    service: string,
    timeWindow: string = '5m'
  ): Promise<ServiceMetrics | null> {
    try {
      // Determine which rollup table to use based on time window
      let table: string;
      let windowFunction: string;
      
      switch (timeWindow) {
        case '1m':
          table = 'metrics_1m';
          windowFunction = 'toStartOfMinute';
          break;
        case '5m':
          table = 'metrics_5m';
          windowFunction = 'toStartOfFiveMinute';
          break;
        case '15m':
          table = 'metrics_15m';
          windowFunction = 'toStartOfFifteenMinute';
          break;
        case '1h':
          table = 'metrics_1h';
          windowFunction = 'toStartOfHour';
          break;
        default:
          table = 'metrics_5m';
          windowFunction = 'toStartOfFiveMinute';
      }

      // Calculate time window in seconds
      const windowSeconds = this.parseTimeWindow(timeWindow);
      const startTime = new Date(Date.now() - windowSeconds * 1000);

      // Escape service name for SQL injection prevention
      const escapedService = service.replace(/'/g, "''");
      const startTimeStr = startTime.toISOString().replace('T', ' ').substring(0, 19);
      
      const query = `
        SELECT
          countMerge(count_total) AS total_requests,
          countMerge(count_success) AS successful_requests,
          countMerge(count_error) AS failed_requests,
          quantileMerge(0.50)(p50_latency) AS p50_latency,
          quantileMerge(0.95)(p95_latency) AS p95_latency,
          quantileMerge(0.99)(p99_latency) AS p99_latency,
          avgMerge(avg_latency) AS avg_latency
        FROM ${table}
        WHERE service = '${escapedService}'
          AND window_start >= '${startTimeStr}'
        GROUP BY service
      `;

      const result = await clickHouseClient.execute(query);

      if (result.rows === 0 || !result.data || result.data.length === 0) {
        return null;
      }

      const row = result.data[0];
      const totalRequests = Number(row.total_requests) || 0;
      const successfulRequests = Number(row.successful_requests) || 0;
      const failedRequests = Number(row.failed_requests) || 0;
      const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
      const throughput = totalRequests / (windowSeconds || 1);

      return {
        service: service,
        timestamp: new Date().toISOString(),
        totalRequests: totalRequests,
        successfulRequests: successfulRequests,
        failedRequests: failedRequests,
        averageLatency: Number(row.avg_latency) || 0,
        p50Latency: Number(row.p50_latency) || 0,
        p95Latency: Number(row.p95_latency) || 0,
        p99Latency: Number(row.p99_latency) || 0,
        errorRate: errorRate,
        throughput: throughput,
      };
    } catch (error: any) {
      logger.error(`❌ Error querying service metrics from ClickHouse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Query time series data for a service
   */
  async queryTimeSeries(
    service: string,
    start: Date,
    end: Date,
    granularity: '1m' | '5m' | '15m' | '1h' = '5m'
  ): Promise<TimeSeriesDataPoint[]> {
    try {
      let table: string;
      switch (granularity) {
        case '1m':
          table = 'metrics_1m';
          break;
        case '5m':
          table = 'metrics_5m';
          break;
        case '15m':
          table = 'metrics_15m';
          break;
        case '1h':
          table = 'metrics_1h';
          break;
        default:
          table = 'metrics_5m';
      }

      // Escape service name for SQL injection prevention
      const escapedService = service.replace(/'/g, "''");
      const startTimeStr = start.toISOString().replace('T', ' ').substring(0, 19);
      const endTimeStr = end.toISOString().replace('T', ' ').substring(0, 19);
      
      const query = `
        SELECT
          window_start,
          countMerge(count_total) AS total_requests,
          countMerge(count_success) AS successful_requests,
          countMerge(count_error) AS failed_requests,
          quantileMerge(0.50)(p50_latency) AS p50_latency,
          quantileMerge(0.95)(p95_latency) AS p95_latency,
          quantileMerge(0.99)(p99_latency) AS p99_latency,
          avgMerge(avg_latency) AS avg_latency
        FROM ${table}
        WHERE service = '${escapedService}'
          AND window_start >= '${startTimeStr}'
          AND window_start <= '${endTimeStr}'
        GROUP BY window_start
        ORDER BY window_start ASC
      `;

      const result = await clickHouseClient.execute(query);

      if (result.rows === 0 || !result.data || result.data.length === 0) {
        return [];
      }

      return result.data.map((row: any) => {
        const totalRequests = Number(row.total_requests) || 0;
        const successfulRequests = Number(row.successful_requests) || 0;
        const failedRequests = Number(row.failed_requests) || 0;
        const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
        
        // Calculate throughput based on window size
        const windowSeconds = this.parseTimeWindow(granularity);
        const throughput = totalRequests / (windowSeconds || 1);

        return {
          window_start: row.window_start,
          total_requests: totalRequests,
          successful_requests: successfulRequests,
          failed_requests: failedRequests,
          p50_latency: Number(row.p50_latency) || 0,
          p95_latency: Number(row.p95_latency) || 0,
          p99_latency: Number(row.p99_latency) || 0,
          avg_latency: Number(row.avg_latency) || 0,
          error_rate: errorRate,
          throughput: throughput,
        };
      });
    } catch (error: any) {
      logger.error(`❌ Error querying time series from ClickHouse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get list of services with recent activity
   */
  async getActiveServices(hours: number = 24): Promise<string[]> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const startTimeStr = startTime.toISOString().replace('T', ' ').substring(0, 19);
      
      const query = `
        SELECT DISTINCT service
        FROM events
        WHERE ts >= '${startTimeStr}'
        ORDER BY service ASC
      `;

      const result = await clickHouseClient.execute(query);

      if (result.rows === 0 || !result.data || result.data.length === 0) {
        return [];
      }

      return result.data.map((row: any) => row.service);
    } catch (error: any) {
      logger.error(`❌ Error getting active services from ClickHouse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper to parse time window string to seconds
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([mh])$/);
    if (!match) {
      return 300; // Default to 5 minutes
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'm') {
      return value * 60;
    } else if (unit === 'h') {
      return value * 60 * 60;
    }

    return 300; // Default to 5 minutes
  }
}

export const clickHouseRepository = new ClickHouseRepository();

