// Use runtime env vars for server-side (not NEXT_PUBLIC_* which are build-time)
const KONG_URL = process.env.KONG_URL || process.env.NEXT_PUBLIC_KONG_URL || 'http://kong:8000';
const API_KEY = process.env.KONG_API_KEY || process.env.NEXT_PUBLIC_KONG_API_KEY || 'test-key';

// Client-side API URL (for browser)
const CLIENT_KONG_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_KONG_URL || 'http://localhost:8000')
  : KONG_URL;
const CLIENT_API_KEY = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_KONG_API_KEY || 'test-key')
  : API_KEY;

async function get<T>(path: string, isClient = false): Promise<T | null> {
  try {
    const baseUrl = isClient ? CLIENT_KONG_URL : KONG_URL;
    const apiKey = isClient ? CLIENT_API_KEY : API_KEY;
    const url = `${baseUrl}${path}`;
    
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      cache: 'no-store',
      mode: 'cors',
      credentials: 'omit'
    };
    
    const res = await fetch(url, fetchOptions);
    
    if (!res.ok) {
      console.error(`API error: ${res.status} ${res.statusText} for ${url}`);
      console.error('Response headers:', Object.fromEntries(res.headers.entries()));
      return null;
    }
    
    const data = await res.json();
    return data as T;
  } catch (error: any) {
    console.error(`API fetch error for ${path}:`, error);
    console.error('Error details:', error.message, error.stack);
    return null;
  }
}

export async function getServices(timeWindow?: string): Promise<any | null> {
  const path = timeWindow 
    ? `/api/v1/metrics/services?timeWindow=${timeWindow}`
    : '/api/v1/metrics/services';
  return get<any>(path);
}

export async function getServiceMetrics(serviceName: string, timeWindow = '5m'): Promise<any | null> {
  return get<any>(`/api/v1/metrics/service/${encodeURIComponent(serviceName)}?timeWindow=${timeWindow}`);
}

// Client-side version
export async function getServicesClient(timeWindow?: string): Promise<any | null> {
  const path = timeWindow 
    ? `/api/v1/metrics/services?timeWindow=${timeWindow}`
    : '/api/v1/metrics/services';
  return get<any>(path, true);
}

export async function getServiceMetricsClient(serviceName: string, timeWindow = '5m'): Promise<any | null> {
  return get<any>(`/api/v1/metrics/service/${encodeURIComponent(serviceName)}?timeWindow=${timeWindow}`, true);
}

export async function getServiceTimeSeriesClient(
  serviceName: string,
  startTime: string,
  endTime: string,
  granularity: '1m' | '5m' | '15m' | '1h' = '5m'
): Promise<any | null> {
  const url = `/api/v1/metrics/service/${encodeURIComponent(serviceName)}/timeseries?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&granularity=${granularity}`;
  return get<any>(url, true);
}

export async function getAnomaliesClient(): Promise<any | null> {
  return get<any>('/api/v1/metrics/anomalies', true);
}

export async function getServiceAnomalyClient(serviceName: string): Promise<any | null> {
  return get<any>(`/api/v1/metrics/service/${encodeURIComponent(serviceName)}/anomalies`, true);
}

// Demo API functions
async function post<T>(path: string, body?: any, isClient = false): Promise<T | null> {
  try {
    const baseUrl = isClient ? CLIENT_KONG_URL : KONG_URL;
    const apiKey = isClient ? CLIENT_API_KEY : API_KEY;
    const url = `${baseUrl}${path}`;
    
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      mode: 'cors',
      credentials: 'omit'
    };
    
    const res = await fetch(url, fetchOptions);
    
    if (!res.ok) {
      console.error(`API error: ${res.status} ${res.statusText} for ${url}`);
      return null;
    }
    
    const data = await res.json();
    return data as T;
  } catch (error: any) {
    console.error(`API fetch error for ${path}:`, error);
    return null;
  }
}

export interface ScenarioStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentScenario: string | null;
  startTime: number | null;
  elapsedTime: number;
  eventsGenerated: number;
}

export interface ControlPlaneDecision {
  serviceName: string;
  decisionType: 'SCALE_UP' | 'SCALE_DOWN' | 'RESTART_PODS' | 'CIRCUIT_BREAK' | 'NO_ACTION';
  confidence: number;
  metrics: {
    p95Latency: number;
    errorRate: number;
    healthScore: number;
    throughput: number;
  };
  action: {
    description: string;
    currentPods?: number;
    targetPods?: number;
    estimatedRecoveryTime?: number;
  };
  reasoning: string[];
  timestamp: string;
}

export async function getScenarioStatusClient(): Promise<ScenarioStatus | null> {
  const response = await get<{ success: boolean; data: ScenarioStatus }>('/api/v1/demo/scenarios/status', true);
  return response?.data || null;
}

export async function startScenarioClient(scenarioName: string): Promise<ScenarioStatus | null> {
  const response = await post<{ success: boolean; data: ScenarioStatus }>(
    `/api/v1/demo/scenarios/${scenarioName}/start`,
    undefined,
    true
  );
  return response?.data || null;
}

export async function stopScenarioClient(scenarioName: string): Promise<ScenarioStatus | null> {
  const response = await post<{ success: boolean; data: ScenarioStatus }>(
    `/api/v1/demo/scenarios/${scenarioName}/stop`,
    undefined,
    true
  );
  return response?.data || null;
}

export async function pauseScenarioClient(scenarioName: string): Promise<ScenarioStatus | null> {
  const response = await post<{ success: boolean; data: ScenarioStatus }>(
    `/api/v1/demo/scenarios/${scenarioName}/pause`,
    undefined,
    true
  );
  return response?.data || null;
}

export async function resumeScenarioClient(scenarioName: string): Promise<ScenarioStatus | null> {
  const response = await post<{ success: boolean; data: ScenarioStatus }>(
    `/api/v1/demo/scenarios/${scenarioName}/resume`,
    undefined,
    true
  );
  return response?.data || null;
}

export async function getControlPlaneDecisionsClient(timeWindow = '5m'): Promise<ControlPlaneDecision[]> {
  const response = await get<{ success: boolean; data: ControlPlaneDecision[] }>(
    `/api/v1/demo/control-plane/decisions?timeWindow=${timeWindow}`,
    true
  );
  return response?.data || [];
}

export async function getServiceDecisionClient(serviceName: string, timeWindow = '5m'): Promise<ControlPlaneDecision | null> {
  const response = await get<{ success: boolean; data: ControlPlaneDecision }>(
    `/api/v1/demo/control-plane/decisions/${encodeURIComponent(serviceName)}?timeWindow=${timeWindow}`,
    true
  );
  return response?.data || null;
}
