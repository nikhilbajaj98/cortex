import { Pool } from 'pg';
import logger from '../../utils/logger';

export const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  port: parseInt(process.env.PG_PORT || '5432'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('connect', () => logger.info('📡 Connected to PostgreSQL'));
pool.on('error', (err: Error) => logger.error(`❌ PostgreSQL connection error: ${err.message}`));

