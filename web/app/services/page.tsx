'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getServicesClient, getAnomaliesClient } from '../../lib/api';

const TIME_WINDOWS = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
];

export default function ServicesPage() {
  const [data, setData] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState('5m');

  const fetchData = async (window: string) => {
    setLoading(true);
    setError(null);
    try {
      const [servicesRes, anomaliesRes] = await Promise.all([
        getServicesClient(window),
        getAnomaliesClient(),
      ]);
      if (servicesRes) {
        setData(servicesRes);
        if (anomaliesRes?.anomalies) {
          const map: Record<string, any> = {};
          for (const a of anomaliesRes.anomalies) map[a.service] = a;
          setAnomalies(map);
        } else {
          setAnomalies({});
        }
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
              <td>
                <strong>{s.metrics?.totalRequests ?? 0}</strong>
                {anomalies[s.service] ? (
                  <span title={`Anomaly: ${anomalies[s.service].metric} z=${(anomalies[s.service].zScore || 0).toFixed(2)}`}
                        style={{ marginLeft: 8, padding: '2px 6px', borderRadius: 10, background: '#ffe6e6', color: '#b30000', fontSize: 12 }}>
                    Anomaly
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
