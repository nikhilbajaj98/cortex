import { Router } from 'express';
import { ingestRouter } from './routes/ingest';
import { kongIngestRouter } from './routes/kongIngest';
import { metricsRouter } from './routes/metrics';
import { demoRouter } from './routes/demo';

export const v1Router = Router();

// Mount all v1 routes
v1Router.use('/ingest', ingestRouter);
v1Router.use('/ingest/kong', kongIngestRouter);
v1Router.use('/metrics', metricsRouter);
v1Router.use('/demo', demoRouter);

// Health check endpoint
v1Router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    version: 'v1',
    timestamp: new Date().toISOString()
  });
});
