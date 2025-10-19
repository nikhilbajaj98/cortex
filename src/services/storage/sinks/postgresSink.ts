import { pool } from '../../../infrastructure/connections/database';
import { CortexEvent } from '../../../api/shared/types/event';
import logger from '../../../utils/logger';

export async function saveEventToPostgres(event: CortexEvent){
  const query =
   `INSERT INTO events (type, service, status, latency, timestamp, metadata, ip)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`; 
  const values = [event.type, event.service, event.status, event.latency, event.timestamp, event.metadata, event.ip];
  try {
    await pool.query(query, values);
    logger.info(`📤 Event saved to PostgreSQL: ${event.service}`);
  } catch (error) {
    logger.error(`❌ Error saving event to PostgreSQL: ${error}`);
    throw error;
  }
}