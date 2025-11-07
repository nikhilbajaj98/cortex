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
