import { Router } from 'express';
import { ingestRouter } from './routes/ingest';
import { metricsRouter } from './routes/metrics';

export const v1Router = Router();

// Mount all v1 routes
v1Router.use('/ingest', ingestRouter);
v1Router.use('/metrics', metricsRouter);

// Health check endpoint
v1Router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    version: 'v1',
    timestamp: new Date().toISOString()
  });
});
