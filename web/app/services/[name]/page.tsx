'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getServiceMetricsClient } from '../../../lib/api';

const TIME_WINDOWS = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
];

function ServiceDetailContent({ params }: { params: { name: string } }) {
  const searchParams = useSearchParams();
  const svc = decodeURIComponent(params.name);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState(searchParams?.get('timeWindow') || '5m');

  const fetchData = async (window: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getServiceMetricsClient(svc, window);
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
  }, [timeWindow, svc]);

  if (loading && !data) {
    return (
      <div>
        <h1>Service: {svc}</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1>Service: {svc}</h1>
        <p style={{ color: '#d00' }}>Error: {error}</p>
      </div>
    );
  }

  const m = data?.metrics;
  const agg = data?.aggregation;
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Service: {svc}</h1>
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
      
      {!data ? (
        <p>No data</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <h3>Snapshot</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Stat label="Total Requests" value={m?.totalRequests ?? 0} />
              <Stat label="Error Rate" value={`${m?.errorRate ?? 0}%`} />
              <Stat label="Latency p50" value={`${m?.p50Latency ?? '-'} ms`} />
              <Stat label="Latency p95" value={`${m?.p95Latency ?? '-'} ms`} />
              <Stat label="Latency p99" value={`${m?.p99Latency ?? '-'} ms`} />
            </div>
          </div>
          <div>
            <h3>Distribution</h3>
            <pre style={{ background: '#fafafa', border: '1px solid #eee', padding: 12 }}>
              {JSON.stringify(agg?.statusDistribution ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function ServiceDetail({ params }: { params: { name: string } }) {
  return (
    <Suspense fallback={<div><h1>Service: {decodeURIComponent(params.name)}</h1><p>Loading...</p></div>}>
      <ServiceDetailContent params={params} />
    </Suspense>
  );
}
