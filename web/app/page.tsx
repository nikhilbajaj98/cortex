'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getServicesClient } from '../lib/api';

const TIME_WINDOWS = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState('5m');
  const [totalEvents, setTotalEvents] = useState<number | null>(null);

  const fetchData = async (window: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getServicesClient(window);
      if (result) {
        setData(result);
        // Calculate total events across all services
        const total = result.services?.reduce((sum: number, s: any) => 
          sum + (s.metrics?.totalRequests || 0), 0) || 0;
        setTotalEvents(total);
      } else {
        setError('Failed to load data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(timeWindow);
  }, [timeWindow]);

  if (loading && !data) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p style={{ color: '#d00' }}>Error: {error}</p>
      </div>
    );
  }

  const services = data?.services ?? [];
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 14 }}>
            Time Window:
            <select 
              value={timeWindow} 
              onChange={(e) => setTimeWindow(e.target.value)}
              style={{ marginLeft: 8, padding: '4px 8px', fontSize: 14 }}
            >
              {TIME_WINDOWS.map(tw => (
                <option key={tw.value} value={tw.value}>{tw.label}</option>
              ))}
            </select>
          </label>
          {totalEvents !== null && (
            <span style={{ fontSize: 14, color: '#666', fontWeight: 600 }}>
              Total Events: {totalEvents.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      
      <p style={{ color: '#666' }}>Active services ({data?.totalServices ?? services.length})</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {services.map((s: any) => (
          <div key={s.service} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Link href={`/services/${encodeURIComponent(s.service)}?timeWindow=${timeWindow}`} style={{ fontWeight: 600 }}>{s.service}</Link>
              <span style={{ fontSize: 12, color: '#888' }}>{s.metrics?.timestamp}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 14 }}>
              <span>Latency p95: {s.metrics?.p95Latency ?? '-'} ms</span>
              <span>Error rate: {s.metrics?.errorRate ?? '-'}%</span>
              <span>Requests: <strong>{s.metrics?.totalRequests ?? 0}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
