'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getServicesClient } from '../../lib/api';

const TIME_WINDOWS = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
];

export default function ServicesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState('5m');

  const fetchData = async (window: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getServicesClient(window);
      if (result) {
        setData(result);
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
        <h1>Services</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1>Services</h1>
        <p style={{ color: '#d00' }}>Error: {error}</p>
      </div>
    );
  }

  const services = data?.services ?? [];
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Services</h1>
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
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '8px 0' }}>Service</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '8px 0' }}>Latency p95</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '8px 0' }}>Error rate</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: '8px 0' }}>Requests</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s: any) => (
            <tr key={s.service}>
              <td style={{ padding: '8px 0' }}>
                <Link href={`/services/${encodeURIComponent(s.service)}?timeWindow=${timeWindow}`}>{s.service}</Link>
              </td>
              <td>{s.metrics?.p95Latency ?? '-'}</td>
              <td>{s.metrics?.errorRate ?? '-'}%</td>
              <td><strong>{s.metrics?.totalRequests ?? 0}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
