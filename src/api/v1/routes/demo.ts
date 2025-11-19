import { Router, Request, Response } from 'express';
import { scenarioGenerator, ScenarioName } from '../../../services/demo/scenarioGenerator';
import { controlPlaneSimulator } from '../../../services/demo/controlPlaneSimulator';
import logger from '../../../utils/logger';
import { demoRateLimit } from '../middleware/rateLimit';

export const demoRouter = Router();

// Apply permissive rate limiting for demo endpoints (allows frequent polling)
demoRouter.use(demoRateLimit);

/**
 * GET /api/v1/demo/scenarios/status
 * Get current scenario status
 */
demoRouter.get('/scenarios/status', (req: Request, res: Response) => {
  try {
    const state = scenarioGenerator.getState();
    res.status(200).json({
      success: true,
      data: state,
    });
  } catch (error) {
    logger.error(`❌ Error getting scenario status: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get scenario status',
    });
  }
});

/**
 * POST /api/v1/demo/scenarios/:scenarioName/start
 * Start a demo scenario
 */
demoRouter.post('/scenarios/:scenarioName/start', async (req: Request, res: Response) => {
  try {
    const { scenarioName } = req.params;
    
    if (!['normal-traffic', 'latency-spike', 'error-storm', 'traffic-surge', 'multi-service-chaos'].includes(scenarioName)) {
      return res.status(400).json({
        success: false,
        error: `Invalid scenario name: ${scenarioName}`,
      });
    }

    await scenarioGenerator.startScenario(scenarioName as ScenarioName);
    
    res.status(200).json({
      success: true,
      message: `Scenario ${scenarioName} started`,
      data: scenarioGenerator.getState(),
    });
  } catch (error: any) {
    logger.error(`❌ Error starting scenario: ${error}`);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start scenario',
    });
  }
});

/**
 * POST /api/v1/demo/scenarios/:scenarioName/stop
 * Stop the current scenario
 */
demoRouter.post('/scenarios/:scenarioName/stop', (req: Request, res: Response) => {
  try {
    scenarioGenerator.stopScenario();
    
    res.status(200).json({
      success: true,
      message: 'Scenario stopped',
      data: scenarioGenerator.getState(),
    });
  } catch (error) {
    logger.error(`❌ Error stopping scenario: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to stop scenario',
    });
  }
});

/**
 * POST /api/v1/demo/scenarios/:scenarioName/pause
 * Pause the current scenario
 */
demoRouter.post('/scenarios/:scenarioName/pause', (req: Request, res: Response) => {
  try {
    scenarioGenerator.pauseScenario();
    
    res.status(200).json({
      success: true,
      message: 'Scenario paused',
      data: scenarioGenerator.getState(),
    });
  } catch (error) {
    logger.error(`❌ Error pausing scenario: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to pause scenario',
    });
  }
});

/**
 * POST /api/v1/demo/scenarios/:scenarioName/resume
 * Resume the current scenario
 */
demoRouter.post('/scenarios/:scenarioName/resume', (req: Request, res: Response) => {
  try {
    scenarioGenerator.resumeScenario();
    
    res.status(200).json({
      success: true,
      message: 'Scenario resumed',
      data: scenarioGenerator.getState(),
    });
  } catch (error) {
    logger.error(`❌ Error resuming scenario: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to resume scenario',
    });
  }
});

/**
 * GET /api/v1/demo/control-plane/decisions
 * Get control plane decisions for all services
 */
demoRouter.get('/control-plane/decisions', async (req: Request, res: Response) => {
  try {
    const { timeWindow = '5m' } = req.query;
    const timeWindowStr = typeof timeWindow === 'string' ? timeWindow : '5m';
    
    const decisions = await controlPlaneSimulator.getAllDecisions(timeWindowStr);
    
    res.status(200).json({
      success: true,
      data: decisions,
    });
  } catch (error) {
    logger.error(`❌ Error getting control plane decisions: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get control plane decisions',
    });
  }
});

/**
 * GET /api/v1/demo/control-plane/decisions/:serviceName
 * Get control plane decision for a specific service
 */
demoRouter.get('/control-plane/decisions/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const { timeWindow = '5m' } = req.query;
    const timeWindowStr = typeof timeWindow === 'string' ? timeWindow : '5m';
    
    const decision = await controlPlaneSimulator.generateDecision(serviceName, timeWindowStr);
    
    if (!decision) {
      return res.status(404).json({
        success: false,
        error: `No decision available for service: ${serviceName}`,
      });
    }
    
    res.status(200).json({
      success: true,
      data: decision,
    });
  } catch (error) {
    logger.error(`❌ Error getting control plane decision: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get control plane decision',
    });
  }
});

/**
 * POST /api/v1/demo/control-plane/decisions/:decisionId/execute
 * Simulate executing a control plane decision (for demo purposes)
 */
demoRouter.post('/control-plane/decisions/:decisionId/execute', (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;
    
    // This is a simulation - in real implementation, this would call K8s API
    logger.info(`🎯 Simulating execution of decision: ${decisionId}`);
    
    res.status(200).json({
      success: true,
      message: 'Decision execution simulated (demo mode)',
      data: {
        decisionId,
        executed: true,
        timestamp: new Date().toISOString(),
        note: 'In production, this would execute the actual K8s action',
      },
    });
  } catch (error) {
    logger.error(`❌ Error executing decision: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to execute decision',
    });
  }
});


