import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import { apiRouter } from './api';
import { errorHandler, notFoundHandler } from './api/v1/middleware/errorHandler';
import { kafkaProducer } from './services/messaging/kafkaProducer';
import { kafkaAdmin } from './services/messaging/kafkaAdmin';
import { createKafkaConsumer } from './services/messaging/kafkaConsumer';
import { storageSinkConsumer } from './services/storage/consumers/storageConsumer';
import { analyticsConsumer } from './services/analytics/analyticsConsumer';
import logger from './utils/logger';

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

  // Initialize Kafka services
  await initializeKafka();
});
