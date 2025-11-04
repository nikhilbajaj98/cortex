import { Router, Request, Response } from 'express';
import { metricsCalculator } from '../../services/analytics/metricsCalculator';
import { healthScorer } from '../../services/analytics/healthScorer';
import { aggregator } from '../../services/analytics/aggregator';
import logger from '../../utils/logger';
import { apiRateLimit } from '../middleware/rateLimit';

export const metricsRouter = Router();

// Apply rate limiting
metricsRouter.use(apiRateLimit);

// Get metrics for a specific service
metricsRouter.get('/service/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const { timeWindow = '5m' } = req.query;

    logger.info(`📊 Fetching metrics for service: ${serviceName}`);

    // Get cached metrics
    const metrics = metricsCalculator.getCachedMetrics(serviceName);
    const healthScore = healthScorer.getCachedHealthScore(serviceName);
    const serviceAggregation = aggregator.getServiceAggregation(serviceName);

    if (!metrics) {
      return res.status(404).json({
        error: 'NotFound',
        message: `No metrics found for service: ${serviceName}`,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      service: serviceName,
      timeWindow,
      metrics,
      healthScore,
      aggregation: serviceAggregation,
      timestamp: new Date().toISOString()
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
    logger.info('📊 Fetching metrics for all services');

    const allMetrics = metricsCalculator.getAllCachedMetrics();
    const allHealthScores = healthScorer.getAllCachedHealthScores();
    const allServiceAggregations = aggregator.getAllServiceAggregations();

    const services = Array.from(allMetrics.keys()).map(serviceName => ({
      service: serviceName,
      metrics: allMetrics.get(serviceName),
      healthScore: allHealthScores.get(serviceName),
      aggregation: allServiceAggregations.get(serviceName)
    }));

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
    const healthScores = Array.from(allHealthScores.values());

    // Calculate overall system health
    const overallHealth = healthScores.length > 0 
      ? healthScores.reduce((sum, score) => sum + score.overallScore, 0) / healthScores.length
      : 0;

    const healthyServices = healthScores.filter(s => s.status === 'healthy').length;
    const warningServices = healthScores.filter(s => s.status === 'warning').length;
    const criticalServices = healthScores.filter(s => s.status === 'critical').length;

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
    const totalRequests = Array.from(allMetrics.values()).reduce((sum, m) => sum + m.totalRequests, 0);
    const totalErrors = Array.from(allMetrics.values()).reduce((sum, m) => sum + m.failedRequests, 0);
    const averageLatency = Array.from(allMetrics.values()).reduce((sum, m) => sum + m.averageLatency, 0) / allMetrics.size;
    const overallErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Calculate overall health
    const healthScores = Array.from(allHealthScores.values());
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

// Clear analytics cache (admin endpoint)
metricsRouter.delete('/cache', async (req: Request, res: Response) => {
  try {
    logger.info('🗑️ Clearing analytics cache');

    metricsCalculator.clearCache();
    healthScorer.clearCache();
    aggregator.clearCache();

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




