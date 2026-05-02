import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import { apiRouter } from './api';
import { metricsRegistry } from './observability/metrics';
import { errorHandler, notFoundHandler } from './api/v1/middleware/errorHandler';
import { kafkaProducer } from './services/messaging/kafkaProducer';
import { kafkaAdmin } from './services/messaging/kafkaAdmin';
import { createKafkaConsumer } from './services/messaging/kafkaConsumer';
import { storageSinkConsumer } from './services/storage/consumers/storageConsumer';
import { analyticsConsumer } from './services/analytics/analyticsConsumer';
import { clickHouseClient } from './infrastructure/connections/clickhouse';
import logger from './utils/logger';
import { controlPlaneService } from './services/control-plane/controlPlaneService';

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());

// Behind Kong/ingress, trust proxy for correct client IPs and rate-limiting keys
app.set('trust proxy', true);

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', apiRouter);

app.get('/metrics', async (_req, res) => {
  await metricsRegistry.updateClickHouseHealthGauge();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.status(200).send(metricsRegistry.renderPrometheus());
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Cortex - Autonomous Microservice Control Plane',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      api: '/api',
      health: '/api/v1/health',
      metrics: '/api/v1/metrics',
      ingest: '/api/v1/ingest'
    }
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize ClickHouse
async function initializeClickHouse(): Promise<void> {
  try {
    logger.info('🔧 Starting ClickHouse initialization...');
    
    // Check if ClickHouse is reachable
    const isHealthy = await clickHouseClient.ping();
    if (!isHealthy) {
      throw new Error('ClickHouse ping failed');
    }

    // Run health check to verify database and tables exist
    const health = await clickHouseClient.healthCheck();
    if (!health.healthy) {
      logger.warn(`⚠️ ClickHouse health check warning: ${health.message}`);
      logger.warn('⚠️ Continuing - tables may need to be created via migrations');
    } else {
      logger.info('✅ ClickHouse is healthy and ready');
    }

  } catch (error) {
    logger.error(`❌ Failed to initialize ClickHouse: ${error}`);
    logger.warn('⚠️ Continuing without ClickHouse - analytics persistence will be disabled');
    // Don't exit - let the service continue without ClickHouse
  }
}

// Initialize Kafka services
async function initializeKafka(): Promise<void> {
  try {
    logger.info('🔧 Starting Kafka initialization...');
    logger.info(`🔧 KAFKA_BROKERS env var: ${process.env.KAFKA_BROKERS}`);
    
    // Connect Kafka Admin
    await kafkaAdmin.connect();

    // Ensure required topics exist
    await kafkaAdmin.ensureTopicsExist([
      {
        name: 'cortex-events',
        partitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
    ]);

    // Connect Kafka Producer
    await kafkaProducer.connect();

    // Create and connect storage consumer
    const storageConsumer = createKafkaConsumer('cortex-storage-group');
    await storageConsumer.connect();
    await storageConsumer.subscribe('cortex-events', storageSinkConsumer.handleMessage.bind(storageSinkConsumer));
    await storageConsumer.startConsuming();

    // Create and connect analytics consumer
    const analyticsConsumerInstance = createKafkaConsumer('cortex-analytics-group');
    await analyticsConsumerInstance.connect();
    await analyticsConsumerInstance.subscribe('cortex-events', analyticsConsumer.handleMessage.bind(analyticsConsumer));
    await analyticsConsumerInstance.startConsuming();

    logger.info('🚀 Kafka services initialized successfully');

  } catch (error) {
    logger.error(`❌ Failed to initialize Kafka services: ${error}`);
    logger.warn('⚠️ Continuing without Kafka - service will work but events won\'t be published');
    // Don't exit - let the service continue without Kafka
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');

  try {
    await kafkaProducer.disconnect();
    await kafkaAdmin.disconnect();
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error(`❌ Error during shutdown: ${error}`);
    process.exit(1);
  }
});

// Start server
app.listen(PORT, async () => {
  logger.info(`🚀 Cortex Service running on port ${PORT}`);
  logger.info(`📡 API available at http://localhost:${PORT}/api`);
  logger.info(`🏥 Health check available at http://localhost:${PORT}/api/v1/health`);

  // Initialize ClickHouse first (analytics persistence)
  await initializeClickHouse();

  // Initialize Kafka services
  await initializeKafka();

  // Start control plane (dry-run by default)
  controlPlaneService.start();
});
