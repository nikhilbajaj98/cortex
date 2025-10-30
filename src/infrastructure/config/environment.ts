import { AppConfig } from './index';

function getConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '8080'),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    
    database: {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432'),
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'postgres',
      database: process.env.PG_DATABASE || 'cortex',
      max: parseInt(process.env.PG_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '2000'),
    },
    
    kafka: {
      clientId: process.env.KAFKA_CLIENT_ID || 'cortex-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      groupId: process.env.KAFKA_GROUP_ID || 'cortex-group',
      retry: {
        initialRetryTime: parseInt(process.env.KAFKA_RETRY_TIME || '300'),
        retries: parseInt(process.env.KAFKA_RETRIES || '5'),
      },
    },
    
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    },
    
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      s3Bucket: process.env.S3_BUCKET || 'cortex-event-logs',
    },
  };
}

export const config = getConfig();
