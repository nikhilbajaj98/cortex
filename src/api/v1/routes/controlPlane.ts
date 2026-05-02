import { Router, Request, Response } from 'express';
import logger from '../../../utils/logger';
import { apiRateLimit } from '../middleware/rateLimit';
import { controlPlaneService } from '../../../services/control-plane/controlPlaneService';

export const controlPlaneRouter = Router();

// Apply normal API rate limiting
controlPlaneRouter.use(apiRateLimit);

/**
 * GET /api/v1/control-plane/decisions
 * Returns latest decision per active service (in-memory store).
 */
controlPlaneRouter.get('/decisions', (req: Request, res: Response) => {
  try {
    const { timeWindow = '5m' } = req.query;
    const timeWindowStr = typeof timeWindow === 'string' ? timeWindow : '5m';

    // Allow callers to influence the evaluator window used by the background loop.
    controlPlaneService.setTimeWindow(timeWindowStr);
    void (async () => {
      // Ensure store is populated (especially right after startup)
      if (controlPlaneService.getAllDecisions().length === 0) {
        await controlPlaneService.evaluateNow(timeWindowStr);
      }

      const decisions = controlPlaneService.getAllDecisions();
      res.status(200).json({
        decisions,
        total: decisions.length,
        timeWindow: timeWindowStr,
        dryRun: controlPlaneService.isDryRun(),
        timestamp: new Date().toISOString(),
      });
    })();
  } catch (error: any) {
    logger.error(`❌ Error getting control-plane decisions: ${error?.message || error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to get control-plane decisions',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/v1/control-plane/decisions/:serviceName
 * Returns latest decision for a single service.
 */
controlPlaneRouter.get('/decisions/:serviceName', (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const { timeWindow = '5m' } = req.query;
    const timeWindowStr = typeof timeWindow === 'string' ? timeWindow : '5m';

    controlPlaneService.setTimeWindow(timeWindowStr);
    void (async () => {
      if (!controlPlaneService.getDecision(serviceName)) {
        await controlPlaneService.evaluateNow(timeWindowStr);
      }
      const decision = controlPlaneService.getDecision(serviceName);

      if (!decision) {
        return res.status(404).json({
          error: 'NotFound',
          message: `No decision available for service: ${serviceName}`,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        decision,
        timeWindow: timeWindowStr,
        dryRun: controlPlaneService.isDryRun(),
        timestamp: new Date().toISOString(),
      });
    })();
  } catch (error: any) {
    logger.error(`❌ Error getting service decision: ${error?.message || error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to get service decision',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/v1/control-plane/decisions/:serviceName/execute
 * Phase 2: dry-run only (Phase 3 adds real execution).
 */
controlPlaneRouter.post('/decisions/:serviceName/execute', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const result = await controlPlaneService.executeDecision(serviceName);

    if (!result) {
      return res.status(404).json({
        error: 'NotFound',
        message: `No decision found for service: ${serviceName}`,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(`❌ Error executing decision: ${error?.message || error}`);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to execute decision',
      timestamp: new Date().toISOString(),
    });
  }
});

