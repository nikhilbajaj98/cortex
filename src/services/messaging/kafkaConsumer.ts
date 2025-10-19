import { Kafka, Consumer, ConsumerConfig, EachMessagePayload } from 'kafkajs';
import logger from '../../utils/logger';
import { config } from '../../infrastructure/config/environment';

export interface ConsumerMessageHandler {
  (payload: EachMessagePayload): Promise<void>;
}

export class KafkaConsumerService {
  private consumer: Consumer;
  private kafka: Kafka;
  private isConnected: boolean = false;
  private messageHandlers: Map<string, ConsumerMessageHandler> = new Map();

  constructor(groupId?: string) {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: config.kafka.retry.initialRetryTime,
        retries: config.kafka.retry.retries,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: groupId || config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
      allowAutoTopicCreation: false,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      this.isConnected = true;
      logger.info('🔗 Kafka Consumer connected successfully');
    } catch (error) {
      logger.error(`❌ Failed to connect Kafka Consumer: ${error}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.consumer.disconnect();
        this.isConnected = false;
        logger.info('🔌 Kafka Consumer disconnected');
      }
    } catch (error) {
      logger.error(`❌ Error disconnecting Kafka Consumer: ${error}`);
    }
  }

  async subscribe(topic: string, handler: ConsumerMessageHandler): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka Consumer not connected');
    }

    try {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      this.messageHandlers.set(topic, handler);
      
      logger.info(`📥 Subscribed to topic: ${topic}`);
    } catch (error) {
      logger.error(`❌ Failed to subscribe to topic ${topic}: ${error}`);
      throw error;
    }
  }

  async startConsuming(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka Consumer not connected');
    }

    try {
      await this.consumer.run({
        eachMessage: async (payload) => {
          const { topic, partition, message } = payload;
          
          try {
            const handler = this.messageHandlers.get(topic);
            if (!handler) {
              logger.warn(`⚠️ No handler found for topic: ${topic}`);
              return;
            }

            // Parse message
            const event = JSON.parse(message.value?.toString() || '{}');
            
            logger.info(`📨 Processing message from topic ${topic}`);

            await handler(payload);

          } catch (error) {
            logger.error(`❌ Error processing message from topic ${topic}: ${error}`);
            
            // In production, you might want to send to a dead letter queue
            // For now, we'll just log the error and continue
          }
        },
      });

      logger.info('🚀 Kafka Consumer started consuming messages');

    } catch (error) {
      logger.error(`❌ Failed to start consuming: ${error}`);
      throw error;
    }
  }

  async stopConsuming(): Promise<void> {
    try {
      await this.consumer.stop();
      logger.info('⏹️ Kafka Consumer stopped consuming messages');
    } catch (error) {
      logger.error(`❌ Error stopping consumer: ${error}`);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSubscribedTopics(): string[] {
    return Array.from(this.messageHandlers.keys());
  }
}

// Factory function to create consumer instances
export const createKafkaConsumer = (groupId?: string): KafkaConsumerService => {
  return new KafkaConsumerService(groupId);
};
