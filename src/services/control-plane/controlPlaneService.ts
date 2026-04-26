import logger from '../../utils/logger';
import { decisionEngine } from './decisionEngine';
import { decisionStore } from './decisionStore';
import { ActionExecutor } from './actionExecutor';
import { ControlPlaneDecision, ExecuteResult } from './types';

export class ControlPlaneService {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private timeWindow: string;
  private executor: ActionExecutor;

  constructor(opts?: { intervalMs?: number; timeWindow?: string; dryRun?: boolean }) {
    this.intervalMs = opts?.intervalMs ?? Number(process.env.CONTROL_PLANE_INTERVAL_MS || 15000);
    this.timeWindow = opts?.timeWindow ?? (process.env.CONTROL_PLANE_TIME_WINDOW || '5m');
    const dryRun = opts?.dryRun ?? (process.env.CONTROL_PLANE_DRY_RUN !== 'false');
    this.executor = new ActionExecutor(dryRun);
  }

  start(): void {
    if (this.intervalId) return;

    logger.info(
      `🧠 ControlPlaneService starting (intervalMs=${this.intervalMs}, timeWindow=${this.timeWindow}, dryRun=${this.isDryRun()})`
    );

    // Kick once immediately, then on interval
    void this.tick();
    this.intervalId = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    logger.info('🛑 ControlPlaneService stopped');
  }

  isRunning(): boolean {
    return Boolean(this.intervalId);
  }

  isDryRun(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.executor as any).dryRun === true;
  }

  setDryRun(dryRun: boolean): void {
    this.executor.setDryRun(dryRun);
  }

  setTimeWindow(timeWindow: string): void {
    this.timeWindow = timeWindow;
  }

  getAllDecisions(): ControlPlaneDecision[] {
    return decisionStore.getAll();
  }

  getDecision(serviceName: string): ControlPlaneDecision | null {
    return decisionStore.get(serviceName);
  }

  async executeDecision(serviceName: string): Promise<ExecuteResult | null> {
    const decision = this.getDecision(serviceName);
    if (!decision) return null;
    return await this.executor.execute(decision);
  }

  /**
   * Force an immediate evaluation (useful for API polling / tests).
   * Populates the in-memory store with fresh decisions.
   */
  async evaluateNow(timeWindow?: string): Promise<ControlPlaneDecision[]> {
    if (timeWindow) {
      this.timeWindow = timeWindow;
    }

    const decisions = await decisionEngine.evaluateAll(this.timeWindow);
    for (const d of decisions) {
      decisionStore.set(d);
    }
    return decisions;
  }

  private async tick(): Promise<void> {
    try {
      const decisions = await decisionEngine.evaluateAll(this.timeWindow);
      for (const d of decisions) {
        // Keep store updated for API/UI polling.
        decisionStore.set(d);
      }

      logger.debug(`🧠 Control plane evaluated ${decisions.length} services (window=${this.timeWindow})`);
    } catch (err: any) {
      logger.warn(`⚠️ ControlPlaneService tick failed: ${err?.message || err}`);
    }
  }
}

export const controlPlaneService = new ControlPlaneService();

