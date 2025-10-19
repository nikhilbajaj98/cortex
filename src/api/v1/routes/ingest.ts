import { Router, Request, Response } from 'express';
import { processEvent } from '../../../services/core/eventProcessor';
import logger from '../../../utils/logger';
import { ingestRateLimit } from '../middleware/rateLimit';

export const ingestRouter = Router();

// Apply rate limiting
ingestRouter.use(ingestRateLimit);

ingestRouter.post('/', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    logger.info(`📩 Received event: ${JSON.stringify(event)}`);

    await processEvent(event);

    res.status(200).json({ 
      message: 'Event processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`❌ Error processing event: ${error}`);
    res.status(500).json({ 
      error: 'InternalServerError',
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    });
  }
});
