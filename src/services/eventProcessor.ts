import logger from '../utils/logger';

export async function processEvent(event: any) {
  // Simulate async processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  // This is where you'd transform, enrich, or push to Kafka/S3/Postgres
  logger.info(`⚙️ Processed event type: ${event.type || 'unknown'}`);
}
