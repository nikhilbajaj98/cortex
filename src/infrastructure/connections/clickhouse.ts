import { config } from '../config/environment';
import logger from '../../utils/logger';

export interface ClickHouseResponse {
  data: any;
  rows: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

export interface ClickHouseError {
  code: number;
  name: string;
  message: string;
  stack: string;
}

export class ClickHouseClient {
  private baseUrl: string;
  private database: string;
  private user: string;
  private password: string;
  private requestTimeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private circuitBreakerOpen: boolean = false;
  private circuitBreakerFailures: number = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_TIME = 30000; // 30 seconds

  constructor() {
    const chConfig = config.clickhouse;
    this.baseUrl = `http://${chConfig.host}:${chConfig.port}`;
    this.database = chConfig.database;
    this.user = chConfig.user;
    this.password = chConfig.password;
    this.requestTimeout = chConfig.requestTimeout;
    this.maxRetries = chConfig.maxRetries;
    this.retryDelay = chConfig.retryDelay;
    
    logger.info(`🔧 ClickHouse Client initialized: ${this.baseUrl}/${this.database}`);
  }

  /**
   * Execute a query against ClickHouse
   */
  async execute(query: string, params?: Record<string, any>): Promise<ClickHouseResponse> {
    if (this.circuitBreakerOpen) {
      throw new Error('ClickHouse circuit breaker is open - service unavailable');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = new URL(`${this.baseUrl}/?database=${this.database}`);
        
        // Add query with FORMAT JSON for structured responses
        const fullQuery = query.trim().endsWith(';') ? query.trim().slice(0, -1) : query.trim();
        const queryWithFormat = `${fullQuery} FORMAT JSON`;
        url.searchParams.set('query', queryWithFormat);
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(`param_${key}`, String(value));
          });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${this.user}:${this.password}`).toString('base64')}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ClickHouse query failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Parse FORMAT JSON response: { data: [...], rows: number, meta: [...] }
        const responseData = await response.json();
        
        // Reset circuit breaker on success
        this.circuitBreakerFailures = 0;
        this.circuitBreakerOpen = false;

        return {
          data: responseData.data || [],
          rows: responseData.rows || 0,
          statistics: {
            elapsed: 0, // ClickHouse FORMAT JSON doesn't include statistics
            rows_read: responseData.rows || 0,
            bytes_read: 0,
          },
        };
      } catch (error: any) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          throw new Error(`ClickHouse query timeout after ${this.requestTimeout}ms`);
        }

        // If not the last attempt, wait and retry
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt); // Exponential backoff
          logger.warn(`⚠️ ClickHouse query failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
          await this.sleep(delay);
          continue;
        }
      }
    }

    // All retries failed - update circuit breaker
    this.circuitBreakerFailures++;
    if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerOpen = true;
      logger.error(`❌ ClickHouse circuit breaker opened after ${this.circuitBreakerFailures} failures`);
      
      // Reset circuit breaker after timeout
      setTimeout(() => {
        this.circuitBreakerOpen = false;
        this.circuitBreakerFailures = 0;
        logger.info('🔄 ClickHouse circuit breaker reset');
      }, this.CIRCUIT_BREAKER_RESET_TIME);
    }

    throw lastError || new Error('ClickHouse query failed after all retries');
  }

  /**
   * Execute a command against ClickHouse (DDL / non-JSON).
   *
   * Important:
   * - Does NOT append FORMAT JSON (ClickHouse errors on DDL + FORMAT).
   * - Returns raw response text (often empty for DDL).
   */
  async executeCommand(command: string, params?: Record<string, any>): Promise<string> {
    if (this.circuitBreakerOpen) {
      throw new Error('ClickHouse circuit breaker is open - service unavailable');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = new URL(`${this.baseUrl}/?database=${this.database}`);
        const fullCommand = command.trim().endsWith(';') ? command.trim().slice(0, -1) : command.trim();
        url.searchParams.set('query', fullCommand);

        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(`param_${key}`, String(value));
          });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Authorization': `Basic ${Buffer.from(`${this.user}:${this.password}`).toString('base64')}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ClickHouse command failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const text = await response.text();

        // Reset circuit breaker on success
        this.circuitBreakerFailures = 0;
        this.circuitBreakerOpen = false;

        return text;
      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          throw new Error(`ClickHouse command timeout after ${this.requestTimeout}ms`);
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          logger.warn(`⚠️ ClickHouse command failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
          await this.sleep(delay);
          continue;
        }
      }
    }

    // All retries failed - update circuit breaker
    this.circuitBreakerFailures++;
    if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerOpen = true;
      logger.error(`❌ ClickHouse circuit breaker opened after ${this.circuitBreakerFailures} failures`);

      setTimeout(() => {
        this.circuitBreakerOpen = false;
        this.circuitBreakerFailures = 0;
        logger.info('🔄 ClickHouse circuit breaker reset');
      }, this.CIRCUIT_BREAKER_RESET_TIME);
    }

    throw lastError || new Error('ClickHouse command failed after all retries');
  }

  /**
   * Insert data into ClickHouse table
   */
  async insert(table: string, rows: any[], format: string = 'JSONEachRow'): Promise<void> {
    if (this.circuitBreakerOpen) {
      throw new Error('ClickHouse circuit breaker is open - service unavailable');
    }

    if (rows.length === 0) {
      return; // Nothing to insert
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = new URL(`${this.baseUrl}/?database=${this.database}`);
        url.searchParams.set('query', `INSERT INTO ${table} FORMAT ${format}`);
        
        // Format rows based on format type
        let body: string;
        if (format === 'JSONEachRow') {
          body = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
        } else {
          throw new Error(`Unsupported format: ${format}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Authorization': `Basic ${Buffer.from(`${this.user}:${this.password}`).toString('base64')}`,
          },
          body: body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`ClickHouse insert failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Reset circuit breaker on success
        this.circuitBreakerFailures = 0;
        this.circuitBreakerOpen = false;

        logger.debug(`✅ Inserted ${rows.length} rows into ${table}`);
        return;
      } catch (error: any) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          throw new Error(`ClickHouse insert timeout after ${this.requestTimeout}ms`);
        }

        // If not the last attempt, wait and retry
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt); // Exponential backoff
          logger.warn(`⚠️ ClickHouse insert failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
          await this.sleep(delay);
          continue;
        }
      }
    }

    // All retries failed - update circuit breaker
    this.circuitBreakerFailures++;
    if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerOpen = true;
      logger.error(`❌ ClickHouse circuit breaker opened after ${this.circuitBreakerFailures} failures`);
      
      // Reset circuit breaker after timeout
      setTimeout(() => {
        this.circuitBreakerOpen = false;
        this.circuitBreakerFailures = 0;
        logger.info('🔄 ClickHouse circuit breaker reset');
      }, this.CIRCUIT_BREAKER_RESET_TIME);
    }

    throw lastError || new Error('ClickHouse insert failed after all retries');
  }

  /**
   * Ping ClickHouse to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      logger.error(`❌ ClickHouse ping failed: ${error}`);
      return false;
    }
  }

  /**
   * Health check - verify database and table existence
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Escape database name for SQL injection prevention
      const escapedDb = this.database.replace(/'/g, "''");
      
      // Check if database exists
      const dbCheck = await this.execute(`SELECT 1 FROM system.databases WHERE name = '${escapedDb}'`);
      if (dbCheck.rows === 0) {
        return { healthy: false, message: `Database '${this.database}' does not exist` };
      }

      // Check if events table exists
      const tableCheck = await this.execute(`SELECT 1 FROM system.tables WHERE database = '${escapedDb}' AND name = 'events'`);
      if (tableCheck.rows === 0) {
        return { healthy: false, message: `Table 'events' does not exist in database '${this.database}'` };
      }

      return { healthy: true, message: 'ClickHouse is healthy' };
    } catch (error: any) {
      return { healthy: false, message: `Health check failed: ${error.message}` };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const clickHouseClient = new ClickHouseClient();

