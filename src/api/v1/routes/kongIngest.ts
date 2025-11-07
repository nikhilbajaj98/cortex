import { Router, Request, Response } from 'express';
import Joi from 'joi';
import logger from '../../../utils/logger';
import { ingestRateLimit } from '../middleware/rateLimit';
import { kafkaProducer } from '../../../services/messaging/kafkaProducer';

export const kongIngestRouter = Router();

// Apply rate limiting to protect this batch endpoint
kongIngestRouter.use(ingestRateLimit);

// Basic schema for Kong http-log plugin batch (array of entries)
const kongLogEntrySchema = Joi.object({
  request: Joi.object({
    method: Joi.string().optional(),
    uri: Joi.string().optional(),
    headers: Joi.object().unknown(true).optional(),
  }).unknown(true).optional(),
  response: Joi.object({
    status: Joi.number().optional(),
    headers: Joi.object().unknown(true).optional(),
  }).unknown(true).optional(),
  latencies: Joi.object({
    request: Joi.number().optional(),
    proxy: Joi.number().optional(),
    kong: Joi.number().optional(),
  }).unknown(true).optional(),
  route: Joi.object({ name: Joi.string().optional() }).unknown(true).optional(),
  service: Joi.object({ name: Joi.string().optional(), host: Joi.string().optional() }).unknown(true).optional(),
  client_ip: Joi.string().optional(),
  started_at: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
}).unknown(true);

const kongBatchSchema = Joi.array().items(kongLogEntrySchema).min(1);

// Shared secret header to ensure only Kong can call this endpoint
function validateSharedSecret(req: Request): boolean {
  const expected = process.env.KONG_LOG_SECRET || 'changeme';
  const got = req.header('X-Kong-Log-Secret');
  return Boolean(got && expected && got === expected);
}

kongIngestRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!validateSharedSecret(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { error, value } = kongBatchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'InvalidKongBatch', details: error.message });
    }

    const entries: any[] = value;
    const mapped = entries.map((entry) => {
      const requestId = (entry?.request?.headers?.['x-request-id'] || entry?.request?.headers?.['X-Request-ID']) as string | undefined;
      const started = entry?.started_at ? new Date(entry.started_at).toISOString() : new Date().toISOString();
      
      // Extract service name from response headers (set by ingest endpoint)
      // Fallback to route/service name if not available
      const responseHeaders = entry?.response?.headers || {};
      const serviceName = 
        responseHeaders['x-cortex-service'] || 
        responseHeaders['X-Cortex-Service'] ||
        entry?.route?.name || 
        entry?.service?.name || 
        'unknown';

      return {
        type: 'http_request',
        service: serviceName,
        status: entry?.response?.status || 0,
        latency: entry?.latencies?.request || 0,
        timestamp: started,
        metadata: {
          method: entry?.request?.method,
          path: entry?.request?.uri,
          clientIp: entry?.client_ip,
          requestHeaders: entry?.request?.headers,
          responseHeaders: entry?.response?.headers,
          upstreamService: entry?.service,
          route: entry?.route,
          latencies: entry?.latencies,
          requestId,
          edge: 'kong',
        },
        ip: entry?.client_ip || 'unknown',
      };
    });

    try {
      await kafkaProducer.publishBatch('cortex-events', mapped, 'service');
    } catch (pubErr) {
      logger.warn(`⚠️ Failed to publish Kong batch to Kafka: ${pubErr}`);
      // Do not block Kong; accept with 202 so plugin queue can clear
      return res.status(202).json({ accepted: mapped.length, published: 0 });
    }

    res.status(200).json({ accepted: mapped.length, published: mapped.length });
  } catch (e) {
    logger.error(`❌ Error in /api/v1/ingest/kong: ${e}`);
    res.status(500).json({ error: 'InternalServerError' });
  }
});


