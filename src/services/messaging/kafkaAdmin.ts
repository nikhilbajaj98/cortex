import { Kafka, Admin } from 'kafkajs';
import logger from '../../utils/logger';
import { config } from '../../infrastructure/config/environment';

export interface TopicConfig {
  name: string;
  partitions: number;
  replicationFactor: number;
  configEntries?: Array<{ name: string; value: string }>;
}

export class KafkaAdminService {
  private admin: Admin;
  private kafka: Kafka;
  private isConnected: boolean = false;

  constructor() {
    logger.info(`🔧 Kafka Admin - KAFKA_BROKERS: ${process.env.KAFKA_BROKERS}`);
    logger.info(`🔧 Kafka Admin - config.kafka.brokers: ${JSON.stringify(config.kafka.brokers)}`);
    
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: config.kafka.retry.initialRetryTime,
        retries: config.kafka.retry.retries,
      },
    });

    this.admin = this.kafka.admin();
  }

  async connect(): Promise<void> {
    try {
      await this.admin.connect();
      this.isConnected = true;
      logger.info('🔗 Kafka Admin connected successfully');
    } catch (error) {
      logger.error(`❌ Failed to connect Kafka Admin: ${error}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.admin.disconnect();
        this.isConnected = false;
        logger.info('🔌 Kafka Admin disconnected');
      }
    } catch (error) {
      logger.error(`❌ Error disconnecting Kafka Admin: ${error}`);
    }
  }

  async createTopic(topicConfig: TopicConfig): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka Admin not connected');
    }

    try {
      await this.admin.createTopics({
        topics: [{
          topic: topicConfig.name,
          numPartitions: topicConfig.partitions,
          replicationFactor: topicConfig.replicationFactor,
          configEntries: topicConfig.configEntries || [],
        }],
      });

      logger.info(`📝 Created topic: ${topicConfig.name}`);

    } catch (error) {
      logger.error(`❌ Failed to create topic ${topicConfig.name}: ${error}`);
      throw error;
    }
  }

  async createTopics(topics: TopicConfig[]): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka Admin not connected');
    }

    try {
      const topicConfigs = topics.map(topic => ({
        topic: topic.name,
        numPartitions: topic.partitions,
        replicationFactor: topic.replicationFactor,
        configEntries: topic.configEntries || [],
      }));

      await this.admin.createTopics({
        topics: topicConfigs,
      });

      logger.info(`📝 Created ${topics.length} topics`);

    } catch (error) {
      logger.error(`❌ Failed to create topics: ${error}`);
      throw error;
    }
  }

  async deleteTopic(topicName: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka Admin not connected');
    }

    try {
      await this.admin.deleteTopics({
        topics: [topicName],
      });

      logger.info(`🗑️ Deleted topic: ${topicName}`);

    } catch (error) {
      logger.error(`❌ Failed to delete topic ${topicName}: ${error}`);
      throw error;
    }
  }

  async listTopics(): Promise<string[]> {
    if (!this.isConnected) {
      throw new Error('Kafka Admin not connected');
    }

    try {
      const metadata = await this.admin.fetchTopicMetadata();
      const topics = metadata.topics.map(topic => topic.name);
      
      logger.info(`📋 Listed ${topics.length} topics`);
      return topics;

    } catch (error) {
      logger.error(`❌ Failed to list topics: ${error}`);
      throw error;
    }
  }

  async getTopicMetadata(topicName: string): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Kafka Admin not connected');
    }

    try {
      const metadata = await this.admin.fetchTopicMetadata({
        topics: [topicName],
      });

      return metadata.topics[0];

    } catch (error) {
      logger.error(`❌ Failed to get metadata for topic ${topicName}: ${error}`);
      throw error;
    }
  }

  async ensureTopicsExist(topics: TopicConfig[]): Promise<void> {
    try {
      const existingTopics = await this.listTopics();
      const topicsToCreate = topics.filter(topic => !existingTopics.includes(topic.name));

      if (topicsToCreate.length > 0) {
        await this.createTopics(topicsToCreate);
      } else {
        logger.info('✅ All required topics already exist');
      }

    } catch (error) {
      logger.error(`❌ Failed to ensure topics exist: ${error}`);
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const kafkaAdmin = new KafkaAdminService();
