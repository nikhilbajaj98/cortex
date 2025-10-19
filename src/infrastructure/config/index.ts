export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  groupId: string;
  retry: {
    initialRetryTime: number;
    retries: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface AWSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  s3Bucket: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  database: DatabaseConfig;
  kafka: KafkaConfig;
  redis: RedisConfig;
  aws: AWSConfig;
}
