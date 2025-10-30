import { EachMessagePayload } from 'kafkajs';
import logger from '../../../utils/logger';
import { CortexEvent } from '../../../api/shared/types/event';
import { saveEventToPostgres } from '../sinks/postgresSink';
import { saveEventToS3 } from '../sinks/s3Sink';

export class StorageSinkConsumer {
  private batchSize: number = 100;
  private batchTimeout: number = 5000; // 5 seconds
  private eventBatch: CortexEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(batchSize: number = 100, batchTimeout: number = 5000) {
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    try {
      const { message } = payload;
      const event: CortexEvent = JSON.parse(message.value?.toString() || '{}');
      
      // Add to batch
      this.eventBatch.push(event);
      
      // Process batch if it reaches the batch size
      if (this.eventBatch.length >= this.batchSize) {
        await this.processBatch();
      } else {
        // Set timer for batch timeout
        this.setBatchTimer();
      }

    } catch (error) {
      logger.error(`❌ Error handling storage message: ${error}`);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.eventBatch.length === 0) return;

    const batch = [...this.eventBatch];
    this.eventBatch = [];
    
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      // Process batch in parallel
      await Promise.allSettled([
        this.saveToPostgres(batch),
        this.saveToS3(batch),
      ]);

      logger.info(`📦 Processed batch of ${batch.length} events`);

    } catch (error) {
      logger.error(`❌ Error processing batch: ${error}`);
    }
  }

  private async saveToPostgres(events: CortexEvent[]): Promise<void> {
    try {
      // Save events one by one to PostgreSQL
      for (const event of events) {
        await saveEventToPostgres(event);
      }
      
      logger.info(`💾 Saved ${events.length} events to PostgreSQL`);
    } catch (error) {
      logger.error(`❌ Error saving to PostgreSQL: ${error}`);
      throw error;
    }
  }

  private async saveToS3(events: CortexEvent[]): Promise<void> {
    try {
      // Save events one by one to S3
      for (const event of events) {
        await saveEventToS3(event);
      }
      
      logger.info(`☁️ Saved ${events.length} events to S3`);
    } catch (error) {
      logger.error(`❌ Error saving to S3: ${error}`);
      throw error;
    }
  }

  private setBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(async () => {
      await this.processBatch();
    }, this.batchTimeout);
  }

  async flush(): Promise<void> {
    await this.processBatch();
  }
}

// Singleton instance
export const storageSinkConsumer = new StorageSinkConsumer();
