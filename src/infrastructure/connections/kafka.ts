import { Kafka } from 'kafkajs';
import logger from '../../utils/logger';
import { config } from '../config/environment';

/**
 * Centralized Kafka client instance
 * All Kafka services (Producer, Consumer, Admin) should use this shared instance
 * to ensure consistent configuration and connection management
 */
export const kafkaClient = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  retry: {
    initialRetryTime: config.kafka.retry.initialRetryTime,
    retries: config.kafka.retry.retries,
  },
});

logger.info(`🔧 Kafka Client initialized: ${config.kafka.clientId} -> ${config.kafka.brokers.join(', ')}`);

