import logger from '../../utils/logger';
import { CortexEvent } from '../../api/shared/types/event';
import { kafkaProducer } from '../messaging/kafkaProducer';

export async function processEvent(event: any) {
  try {
    const cortexEvent = validateAndEnrichEvent(event);
    
    logger.info(`⚙️ Event processed: ${cortexEvent.type}`);

    // Try to publish to Kafka if available
    try {
      await kafkaProducer.publishEvent('cortex-events', cortexEvent, cortexEvent.service);
      logger.info(`📤 Event published to Kafka: ${cortexEvent.type}`);
    } catch (kafkaError) {
      logger.warn(`⚠️ Failed to publish to Kafka (continuing): ${kafkaError}`);
    }

  } catch (error) {
    logger.error(`❌ Error processing event: ${error}`);
    throw error;
  }
}

function validateAndEnrichEvent(event: any): CortexEvent {
  const enrichedEvent: CortexEvent = {
    type: event.type || 'unknown',
    service: event.service || 'unknown',
    status: event.status || 200,
    latency: event.latency || 0,
    timestamp: event.timestamp || new Date().toISOString(),
    metadata: event.metadata || {},
    ip: event.ip || 'unknown',
  };

  enrichedEvent.metadata = {
    ...enrichedEvent.metadata,
    processedAt: new Date().toISOString(),
    processorVersion: '1.0.0',
  };

  return enrichedEvent;
}
