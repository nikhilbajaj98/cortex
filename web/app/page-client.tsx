'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_KONG_URL || 'http://localhost:8000';
const API_KEY = process.env.NEXT_PUBLIC_KONG_API_KEY || 'test-key';

async function fetchServices() {
  const res = await fetch(`${API_URL}/api/v1/metrics/services`, {
    headers: {
      'Content-Type': 'application/json',
      'apikey': API_KEY
    },
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }
  return res.json();
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServices()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
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
      <h1>Dashboard</h1>
      <p style={{ color: '#666' }}>Active services ({data?.totalServices ?? services.length})</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {services.map((s: any) => (
          <div key={s.service} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Link href={`/services/${encodeURIComponent(s.service)}`} style={{ fontWeight: 600 }}>{s.service}</Link>
              <span style={{ fontSize: 12, color: '#888' }}>{s.metrics?.timestamp}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 14 }}>
              <span>Latency p95: {s.metrics?.p95Latency ?? '-'} ms</span>
              <span>Error rate: {s.metrics?.errorRate ?? '-'}%</span>
              <span>Throughput: {s.metrics?.totalRequests ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


