import { Producer } from 'kafkajs';
import logger from '../../utils/logger';
import { kafkaClient } from '../../infrastructure/connections/kafka';

export class KafkaProducerService {
  private producer: Producer;
  private isConnected: boolean = false;

  constructor() {
    logger.info(`🔧 Kafka Producer - KAFKA_BROKERS: ${process.env.KAFKA_BROKERS}`);
    
    this.producer = kafkaClient.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('🔗 Kafka Producer connected successfully');
    } catch (error) {
      logger.error(`❌ Failed to connect Kafka Producer: ${error}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info('🔌 Kafka Producer disconnected');
      }
    } catch (error) {
      logger.error(`❌ Error disconnecting Kafka Producer: ${error}`);
    }
  }

  async publishEvent(topic: string, event: any, key?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka Producer not connected');
    }

    try {
      const message = {
        topic,
        messages: [{
          key: key || event.service || 'default',
          value: JSON.stringify(event),
          timestamp: Date.now().toString(),
          headers: {
            'event-type': event.type || 'unknown',
            'service': event.service || 'unknown',
            'content-type': 'application/json',
          },
        }],
      };

      const result = await this.producer.send(message);
      
      logger.info(`📤 Event published to topic ${topic}`);

    } catch (error) {
      logger.error(`❌ Failed to publish event to topic ${topic}: ${error}`);
      throw error;
    }
  }

  async publishBatch(topic: string, events: any[], keyField?: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka Producer not connected');
    }

    try {
      const messages = events.map(event => ({
        key: keyField ? event[keyField] : event.service || 'default',
        value: JSON.stringify(event),
        timestamp: Date.now().toString(),
        headers: {
          'event-type': event.type || 'unknown',
          'service': event.service || 'unknown',
          'content-type': 'application/json',
        },
      }));

      const result = await this.producer.send({
        topic,
        messages,
      });

      logger.info(`📤 Batch of ${events.length} events published to topic ${topic}`);

    } catch (error) {
      logger.error(`❌ Failed to publish batch to topic ${topic}: ${error}`);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const kafkaProducer = new KafkaProducerService();
