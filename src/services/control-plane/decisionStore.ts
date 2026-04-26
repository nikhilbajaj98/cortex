import { ControlPlaneDecision } from './types';

export class DecisionStore {
  private byService: Map<string, ControlPlaneDecision> = new Map();

  set(decision: ControlPlaneDecision): void {
    this.byService.set(decision.serviceName, decision);
  }

  get(serviceName: string): ControlPlaneDecision | null {
    return this.byService.get(serviceName) || null;
  }

  getAll(): ControlPlaneDecision[] {
    return Array.from(this.byService.values()).sort((a, b) => a.serviceName.localeCompare(b.serviceName));
  }

  clear(): void {
    this.byService.clear();
  }
}

export const decisionStore = new DecisionStore();

