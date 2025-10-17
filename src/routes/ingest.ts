import { Router, Request, Response } from 'express';
import { processEvent } from '../services/eventProcessor';
import logger from '../utils/logger';

export const ingestRouter = Router();

ingestRouter.post('/', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    logger.info(`📩 Received event: ${JSON.stringify(event)}`);

    await processEvent(event);

    res.status(200).json({ message: 'Event processed successfully' });
  } catch (error) {
    logger.error(`❌ Error processing event: ${error}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});
