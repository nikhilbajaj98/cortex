export interface CortexEvent {
  type: string;
  service: string;
  status: number;
  latency: number;
  timestamp: string;
  metadata: Record<string, any>;
  ip: string;
}