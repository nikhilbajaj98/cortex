export type DecisionType =
  | 'SCALE_UP'
  | 'SCALE_DOWN'
  | 'RESTART_PODS'
  | 'CIRCUIT_BREAK'
  | 'NO_ACTION';

export interface ControlPlaneDecision {
  serviceName: string;
  decisionType: DecisionType;
  confidence: number; // 0-100
  metrics: {
    p95Latency: number; // ms
    errorRate: number; // 0..1 (fraction) for UI compatibility
    healthScore: number; // 0..100
    throughput: number; // requests/min for UI compatibility
  };
  action: {
    description: string;
    currentPods?: number;
    targetPods?: number;
    estimatedRecoveryTime?: number; // seconds
    dryRun?: boolean;
  };
  reasoning: string[];
  timestamp: string;
}

export interface ExecuteResult {
  decisionId: string;
  executed: boolean;
  dryRun: boolean;
  timestamp: string;
  message: string;
}

