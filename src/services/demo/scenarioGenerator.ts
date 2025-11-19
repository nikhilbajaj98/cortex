import { CortexEvent } from '../../api/shared/types/event';
import { kafkaProducer } from '../messaging/kafkaProducer';
import logger from '../../utils/logger';

export type ScenarioName = 
  | 'normal-traffic'
  | 'latency-spike'
  | 'error-storm'
  | 'traffic-surge'
  | 'multi-service-chaos';

export interface ScenarioConfig {
  name: ScenarioName;
  duration: number; // seconds
  services: string[];
  pattern: 'steady' | 'gradual' | 'sudden' | 'mixed';
}

export interface ScenarioState {
  isRunning: boolean;
  isPaused: boolean;
  currentScenario: ScenarioName | null;
  startTime: number | null;
  elapsedTime: number;
  eventsGenerated: number;
}

class ScenarioGenerator {
  private state: ScenarioState = {
    isRunning: false,
    isPaused: false,
    currentScenario: null,
    startTime: null,
    elapsedTime: 0,
    eventsGenerated: 0,
  };

  private intervalId: NodeJS.Timeout | null = null;
  private pauseStartTime: number | null = null;
  private totalPausedTime: number = 0;

  private readonly services = [
    'payments-service',
    'checkout-service',
    'inventory-service',
    'shipping-service',
    'notifications-service',
    'analytics-service',
  ];

  /**
   * Generate events for Normal Traffic scenario
   */
  private generateNormalTraffic(): CortexEvent[] {
    const events: CortexEvent[] = [];
    const serviceCount = Math.floor(Math.random() * 3) + 2; // 2-4 services
    const selectedServices = this.services.slice(0, serviceCount);

    for (const service of selectedServices) {
      // Low latency (50-100ms), 0% errors, consistent throughput
      const latency = 50 + Math.random() * 50; // 50-100ms
      const status = 200; // Always success
      
      events.push({
        type: 'http_request',
        service,
        status,
        latency: Math.round(latency),
        timestamp: new Date().toISOString(),
        metadata: {
          path: '/api/v1/endpoint',
          method: 'GET',
        },
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      });
    }

    return events;
  }

  /**
   * Generate events for Latency Spike scenario
   */
  private generateLatencySpike(elapsedSeconds: number): CortexEvent[] {
    const events: CortexEvent[] = [];
    const service = 'payments-service';
    
    // Gradual increase: 50ms → 200ms → 500ms over 2-3 minutes (120-180 seconds)
    const progress = Math.min(elapsedSeconds / 150, 1); // 0 to 1 over 150 seconds
    const baseLatency = 50;
    const maxLatency = 500;
    const latency = baseLatency + (maxLatency - baseLatency) * progress;
    
    // Add some variance
    const variance = (Math.random() - 0.5) * 50;
    const finalLatency = Math.max(50, Math.min(600, latency + variance));
    
    events.push({
      type: 'http_request',
      service,
      status: 200, // Low error rate
      latency: Math.round(finalLatency),
      timestamp: new Date().toISOString(),
      metadata: {
        path: '/api/v1/payments',
        method: 'POST',
      },
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
    });

    return events;
  }

  /**
   * Generate events for Error Storm scenario
   */
  private generateErrorStorm(elapsedSeconds: number): CortexEvent[] {
    const events: CortexEvent[] = [];
    const service = 'checkout-service';
    
    // Sudden spike: 0% → 20% → 40% errors
    // Error storm starts after 10 seconds
    const errorStartTime = 10;
    if (elapsedSeconds < errorStartTime) {
      // Normal traffic before error storm
      events.push({
        type: 'http_request',
        service,
        status: 200,
        latency: 50 + Math.random() * 50,
        timestamp: new Date().toISOString(),
        metadata: { path: '/api/v1/checkout', method: 'POST' },
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      });
    } else {
      // Error storm: 30-40% error rate
      const errorRate = 0.3 + Math.random() * 0.1; // 30-40%
      const status = Math.random() < errorRate ? 500 : 200;
      const latency = status === 500 ? 200 + Math.random() * 300 : 50 + Math.random() * 50;
      
      events.push({
        type: 'http_request',
        service,
        status,
        latency: Math.round(latency),
        timestamp: new Date().toISOString(),
        metadata: {
          path: '/api/v1/checkout',
          method: 'POST',
          error: status === 500 ? 'Internal Server Error' : undefined,
        },
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      });
    }

    return events;
  }

  /**
   * Generate events for Traffic Surge scenario
   */
  private generateTrafficSurge(elapsedSeconds: number): CortexEvent[] {
    const events: CortexEvent[] = [];
    const service = 'inventory-service';
    
    // Sudden increase: 100 → 500 → 1000 req/min
    // Surge starts after 5 seconds
    const surgeStartTime = 5;
    let multiplier = 1;
    
    if (elapsedSeconds >= surgeStartTime) {
      const surgeProgress = Math.min((elapsedSeconds - surgeStartTime) / 60, 1);
      multiplier = 1 + surgeProgress * 9; // 1x to 10x
    }
    
    // Generate multiple events based on multiplier
    const eventCount = Math.floor(1 + multiplier * 2); // 1-20 events per batch
    
    for (let i = 0; i < eventCount; i++) {
      const latency = 50 + Math.random() * 100 * (multiplier > 5 ? 1.5 : 1); // Higher latency under load
      const status = Math.random() < 0.05 ? 500 : 200; // 5% error rate under surge
      
      events.push({
        type: 'http_request',
        service,
        status,
        latency: Math.round(latency),
        timestamp: new Date().toISOString(),
        metadata: {
          path: '/api/v1/inventory',
          method: 'GET',
        },
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      });
    }

    return events;
  }

  /**
   * Generate events for Multi-Service Chaos scenario
   */
  private generateMultiServiceChaos(elapsedSeconds: number): CortexEvent[] {
    const events: CortexEvent[] = [];
    
    // Service A: Healthy (normal traffic)
    events.push({
      type: 'http_request',
      service: 'payments-service',
      status: 200,
      latency: Math.round(50 + Math.random() * 50),
      timestamp: new Date().toISOString(),
      metadata: { path: '/api/v1/payments', method: 'POST' },
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
    });

    // Service B: Latency spike (if elapsed > 20s)
    if (elapsedSeconds > 20) {
      const latencyProgress = Math.min((elapsedSeconds - 20) / 120, 1);
      const latency = 50 + latencyProgress * 400; // 50ms → 450ms
      events.push({
        type: 'http_request',
        service: 'checkout-service',
        status: 200,
        latency: Math.round(latency),
        timestamp: new Date().toISOString(),
        metadata: { path: '/api/v1/checkout', method: 'POST' },
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      });
    }

    // Service C: Error storm (if elapsed > 30s)
    if (elapsedSeconds > 30) {
      const errorRate = 0.2 + Math.random() * 0.2; // 20-40%
      const status = Math.random() < errorRate ? 500 : 200;
      events.push({
        type: 'http_request',
        service: 'inventory-service',
        status,
        latency: Math.round(100 + Math.random() * 200),
        timestamp: new Date().toISOString(),
        metadata: {
          path: '/api/v1/inventory',
          method: 'GET',
          error: status === 500 ? 'Service Unavailable' : undefined,
        },
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      });
    }

    // Service D: Traffic surge (if elapsed > 15s)
    if (elapsedSeconds > 15) {
      const surgeMultiplier = 1 + Math.min((elapsedSeconds - 15) / 60, 1) * 4; // 1x to 5x
      for (let i = 0; i < Math.floor(surgeMultiplier); i++) {
        events.push({
          type: 'http_request',
          service: 'shipping-service',
          status: 200,
          latency: Math.round(50 + Math.random() * 50),
          timestamp: new Date().toISOString(),
          metadata: { path: '/api/v1/shipping', method: 'POST' },
          ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        });
      }
    }

    return events;
  }

  /**
   * Generate events based on scenario
   */
  private generateEvents(scenario: ScenarioName, elapsedSeconds: number): CortexEvent[] {
    switch (scenario) {
      case 'normal-traffic':
        return this.generateNormalTraffic();
      case 'latency-spike':
        return this.generateLatencySpike(elapsedSeconds);
      case 'error-storm':
        return this.generateErrorStorm(elapsedSeconds);
      case 'traffic-surge':
        return this.generateTrafficSurge(elapsedSeconds);
      case 'multi-service-chaos':
        return this.generateMultiServiceChaos(elapsedSeconds);
      default:
        return [];
    }
  }

  /**
   * Publish events to Kafka
   */
  private async publishEvents(events: CortexEvent[]): Promise<void> {
    for (const event of events) {
      try {
        await kafkaProducer.publishEvent('cortex-events', event, event.service);
        this.state.eventsGenerated++;
      } catch (error) {
        logger.warn(`⚠️ Failed to publish demo event: ${error}`);
      }
    }
  }

  /**
   * Start a scenario
   */
  async startScenario(scenario: ScenarioName): Promise<void> {
    if (this.state.isRunning) {
      throw new Error(`Scenario ${this.state.currentScenario} is already running`);
    }

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.currentScenario = scenario;
    this.state.startTime = Date.now();
    this.state.elapsedTime = 0;
    this.state.eventsGenerated = 0;
    this.totalPausedTime = 0;

    logger.info(`🎬 Starting demo scenario: ${scenario}`);

    // Generate events every 2 seconds
    this.intervalId = setInterval(async () => {
      if (this.state.isPaused) {
        return;
      }

      const now = Date.now();
      const actualElapsed = (now - (this.state.startTime || now) - this.totalPausedTime) / 1000;
      this.state.elapsedTime = actualElapsed;

      const events = this.generateEvents(scenario, actualElapsed);
      await this.publishEvents(events);

      logger.debug(`📊 Generated ${events.length} events for scenario ${scenario} (elapsed: ${actualElapsed.toFixed(1)}s)`);
    }, 2000); // Every 2 seconds
  }

  /**
   * Stop the current scenario
   */
  stopScenario(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.currentScenario = null;
    this.state.startTime = null;
    this.state.elapsedTime = 0;
    this.totalPausedTime = 0;

    logger.info('🛑 Demo scenario stopped');
  }

  /**
   * Pause the current scenario
   */
  pauseScenario(): void {
    if (!this.state.isRunning || this.state.isPaused) {
      return;
    }

    this.state.isPaused = true;
    this.pauseStartTime = Date.now();
    logger.info('⏸️ Demo scenario paused');
  }

  /**
   * Resume the current scenario
   */
  resumeScenario(): void {
    if (!this.state.isRunning || !this.state.isPaused) {
      return;
    }

    if (this.pauseStartTime) {
      this.totalPausedTime += Date.now() - this.pauseStartTime;
      this.pauseStartTime = null;
    }

    this.state.isPaused = false;
    logger.info('▶️ Demo scenario resumed');
  }

  /**
   * Get current scenario state
   */
  getState(): ScenarioState {
    return { ...this.state };
  }
}

export const scenarioGenerator = new ScenarioGenerator();


