import { Router } from 'express';
import { v1Router } from './v1';

export const apiRouter = Router();

// Mount API versions
apiRouter.use('/v1', v1Router);

// API info endpoint
apiRouter.get('/', (req, res) => {
  res.status(200).json({
    name: 'Cortex API',
    version: '1.0.0',
    description: 'Autonomous microservice control plane API',
    endpoints: {
      v1: '/api/v1'
    }
  });
});
