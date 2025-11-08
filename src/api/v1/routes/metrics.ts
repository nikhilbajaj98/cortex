import { Router, Request, Response } from 'express';
import { metricsCalculator } from '../../../services/analytics/metricsCalculator';
import { healthScorer } from '../../../services/analytics/healthScorer';
import { aggregator } from '../../../services/analytics/aggregator';
import { analyticsRepository } from '../../../services/analytics/repositories/analyticsRepository';
import logger from '../../../utils/logger';
import { apiRateLimit } from '../middleware/rateLimit';

// Cache TTL: 2 seconds for hot queries
const CACHE_TTL_MS = 2000;
const cacheTimestamps = new Map<string, number>();

export const metricsRouter = Router();

// Apply rate limiting
metricsRouter.use(apiRateLimit);

// Get metrics for a specific service
metricsRouter.get('/service/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const { timeWindow = '5m' } = req.query;
    const timeWindowStr = typeof timeWindow === 'string' ? timeWindow : '5m';

    logger.info(`📊 Fetching metrics for service: ${serviceName} (timeWindow: ${timeWindowStr})`);

    // Check cache first (hot path)
    const cacheKey = `${serviceName}:${timeWindowStr}`;
    const cachedTimestamp = cacheTimestamps.get(cacheKey);
    const isCacheStale = !cachedTimestamp || (Date.now() - cachedTimestamp) > CACHE_TTL_MS;

    let metrics = metricsCalculator.getCachedMetrics(serviceName);
    let healthScore = healthScorer.getCachedHealthScore(serviceName);
    let serviceAggregation = aggregator.getServiceAggregation(serviceName);

    // If cache miss or stale, query ClickHouse
    if (!metrics || isCacheStale) {
      try {
        const clickHouseMetrics = await analyticsRepository.getServiceMetrics(serviceName, timeWindowStr);
        if (clickHouseMetrics) {
          // Update cache with fresh data from ClickHouse
          metricsCalculator.setCachedMetrics(serviceName, clickHouseMetrics);
          metrics = clickHouseMetrics;
          cacheTimestamps.set(cacheKey, Date.now());
          logger.debug(`✅ Fetched metrics from ClickHouse for ${serviceName}`);
        }
      } catch (error: any) {
        logger.warn(`⚠️ Failed to query ClickHouse, using cache: ${error.message}`);
        // Continue with cached metrics if available
      }
    }

    if (!metrics) {
      return res.status(404).json({
        error: 'NotFound',
        message: `No metrics found for service: ${serviceName}`,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      service: serviceName,
      timeWindow: timeWindowStr,
      metrics,
      healthScore,
      aggregation: serviceAggregation,
      timestamp: new Date().toISOString(),
      source: isCacheStale ? 'clickhouse' : 'cache'
    });

  } catch (error) {
    logger.error(`❌ Error fetching service metrics: ${error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get metrics for all services
metricsRouter.get('/services', async (req: Request, res: Response) => {
  try {
    const { timeWindow = '5m' } = req.query;
    const timeWindowStr = typeof timeWindow === 'string' ? timeWindow : '5m';
    logger.info(`📊 Fetching metrics for all services (timeWindow: ${timeWindowStr})`);

    // Try to get active services from ClickHouse
    let activeServices: string[] = [];
    try {
      activeServices = await analyticsRepository.getActiveServices(24);
      logger.debug(`✅ Found ${activeServices.length} active services in ClickHouse`);
    } catch (error: any) {
      logger.warn(`⚠️ Failed to get active services from ClickHouse: ${error.message}`);
      // Fall back to cached services
      const allMetrics = metricsCalculator.getAllCachedMetrics();
      activeServices = Array.from(allMetrics.keys());
    }

    // Get metrics for each active service with the specified time window
    const services = await Promise.all(
      activeServices.map(async (serviceName) => {
        // Check cache first (but cache is per-service, not per-timeWindow, so we'll query ClickHouse)
        const cacheKey = `${serviceName}:${timeWindowStr}`;
        const cachedTimestamp = cacheTimestamps.get(cacheKey);
        const isCacheStale = !cachedTimestamp || (Date.now() - cachedTimestamp) > CACHE_TTL_MS;

        let metrics = isCacheStale ? null : metricsCalculator.getCachedMetrics(serviceName);
        let healthScore = healthScorer.getCachedHealthScore(serviceName);
        let aggregation = aggregator.getServiceAggregation(serviceName);

        // Query ClickHouse with the specified time window
        if (!metrics || isCacheStale) {
          try {
            metrics = await analyticsRepository.getServiceMetrics(serviceName, timeWindowStr);
            if (metrics) {
              metricsCalculator.setCachedMetrics(serviceName, metrics);
              cacheTimestamps.set(cacheKey, Date.now());
            }
          } catch (error) {
            // Ignore errors, use cached metrics if available
          }
        }

        return {
          service: serviceName,
          metrics: metrics || null,
          healthScore: healthScore || null,
          aggregation: aggregation || null
        };
      })
    );

    res.status(200).json({
      services,
      totalServices: services.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Error fetching all service metrics: ${error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get time window aggregations
metricsRouter.get('/aggregations/time-windows', async (req: Request, res: Response) => {
  try {
    const { window = '5m' } = req.query;

    logger.info(`📊 Fetching time window aggregations for window: ${window}`);

    const aggregation = aggregator.getTimeWindowAggregation(window as string);

    if (!aggregation) {
      return res.status(404).json({
        error: 'NotFound',
        message: `No aggregation found for time window: ${window}`,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      window,
      aggregation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Error fetching time window aggregations: ${error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get health scores for all services
metricsRouter.get('/health', async (req: Request, res: Response) => {
  try {
    logger.info('🏥 Fetching health scores for all services');

    const allHealthScores = healthScorer.getAllCachedHealthScores();
    const healthScores = Array.from(allHealthScores.values()) as any[];

    // Calculate overall system health
    const overallHealth = healthScores.length > 0 
      ? healthScores.reduce((sum, score) => sum + score.overallScore, 0) / healthScores.length
      : 0;

    const healthyServices = healthScores.filter((s: any) => s.status === 'healthy').length;
    const warningServices = healthScores.filter((s: any) => s.status === 'warning').length;
    const criticalServices = healthScores.filter((s: any) => s.status === 'critical').length;

    res.status(200).json({
      overallHealth: Math.round(overallHealth * 100) / 100,
      summary: {
        total: healthScores.length,
        healthy: healthyServices,
        warning: warningServices,
        critical: criticalServices
      },
      services: healthScores,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Error fetching health scores: ${error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get system overview
metricsRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    logger.info('📊 Fetching system overview');

    const allMetrics = metricsCalculator.getAllCachedMetrics();
    const allHealthScores = healthScorer.getAllCachedHealthScores();
    const timeWindowAggregations = aggregator.getAllTimeWindowAggregations();

    // Calculate system-wide metrics
    const totalRequests = Array.from(allMetrics.values()).reduce((sum, m: any) => sum + m.totalRequests, 0);
    const totalErrors = Array.from(allMetrics.values()).reduce((sum, m: any) => sum + m.failedRequests, 0);
    const averageLatency = Array.from(allMetrics.values()).reduce((sum, m: any) => sum + m.averageLatency, 0) / (allMetrics.size || 1);
    const overallErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Calculate overall health
    const healthScores = Array.from(allHealthScores.values()) as any[];
    const overallHealth = healthScores.length > 0 
      ? healthScores.reduce((sum, score) => sum + score.overallScore, 0) / healthScores.length
      : 0;

    res.status(200).json({
      system: {
        totalRequests,
        totalErrors,
        averageLatency: Math.round(averageLatency * 100) / 100,
        overallErrorRate: Math.round(overallErrorRate * 100) / 100,
        overallHealth: Math.round(overallHealth * 100) / 100,
        totalServices: allMetrics.size
      },
      timeWindows: Array.from(timeWindowAggregations.values()),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Error fetching system overview: ${error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get time series data for a service (new endpoint)
metricsRouter.get('/service/:serviceName/timeseries', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const { startTime, endTime, granularity = '5m' } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'startTime and endTime query parameters are required',
        timestamp: new Date().toISOString()
      });
    }

    const start = new Date(startTime as string);
    const end = new Date(endTime as string);
    const granularityStr = granularity as '1m' | '5m' | '15m' | '1h';

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid date format for startTime or endTime',
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`📊 Fetching time series for service: ${serviceName} (${start.toISOString()} to ${end.toISOString()})`);

    const timeSeries = await analyticsRepository.getTimeSeries(serviceName, start, end, granularityStr);

    res.status(200).json({
      service: serviceName,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      granularity: granularityStr,
      data: timeSeries,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error(`❌ Error fetching time series: ${error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: error.message || 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get ClickHouse health (new endpoint)
metricsRouter.get('/health/clickhouse', async (req: Request, res: Response) => {
  try {
    const { clickHouseClient } = await import('../../../infrastructure/connections/clickhouse');
    const health = await clickHouseClient.healthCheck();

    res.status(health.healthy ? 200 : 503).json({
      healthy: health.healthy,
      message: health.message,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error(`❌ Error checking ClickHouse health: ${error}`);
    res.status(503).json({
      healthy: false,
      message: error.message || 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Clear analytics cache (admin endpoint)
metricsRouter.delete('/cache', async (req: Request, res: Response) => {
  try {
    logger.info('🗑️ Clearing analytics cache');

    metricsCalculator.clearCache();
    healthScorer.clearCache();
    aggregator.clearCache();
    cacheTimestamps.clear();

    res.status(200).json({
      message: 'Analytics cache cleared successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Error clearing analytics cache: ${error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});




