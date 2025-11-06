type ServiceMetrics = {
  service: string;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    throughput: number;
  };
  aggregation: {
    statusDistribution: Record<string, number>;
    latencyDistribution: { p50: number; p95: number; p99: number };
  };
  healthScore?: { overallScore: number; status: string };
};

const API_BASE = process.env.NEXT_PUBLIC_CORTEX_API || 'http://localhost:8080';

async function fetchService(name: string): Promise<ServiceMetrics | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/metrics/service/${encodeURIComponent(name)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ServiceDetail({ params }: { params: { name: string } }) {
  const data = await fetchService(params.name);
  if (!data) {
    return <div>Service not found or unavailable.</div>;
  }

  const m = data.metrics;
  const dist = data.aggregation?.statusDistribution || {};

  return (
    <div>
      <a href="/" style={{ color: '#93c5fd', textDecoration: 'none' }}>&larr; Back</a>
      <h1 style={{ marginTop: 12 }}>{data.service}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: '12px 0' }}>
        <div style={{ border: '1px solid #22304a', padding: 12, borderRadius: 8 }}>
          <div style={{ opacity: 0.7 }}>Health</div>
          <div>{data.healthScore?.status ?? 'unknown'} ({data.healthScore?.overallScore ?? 0})</div>
        </div>
        <div style={{ border: '1px solid #22304a', padding: 12, borderRadius: 8 }}>
          <div style={{ opacity: 0.7 }}>Requests</div>
          <div>{m.totalRequests} total, {m.successfulRequests} ok, {m.failedRequests} errors</div>
        </div>
        <div style={{ border: '1px solid #22304a', padding: 12, borderRadius: 8 }}>
          <div style={{ opacity: 0.7 }}>Latency (ms)</div>
          <div>avg {Math.round(m.averageLatency)} | p50 {Math.round(m.p50Latency)} | p95 {Math.round(m.p95Latency)} | p99 {Math.round(m.p99Latency)}</div>
        </div>
      </div>
      <div style={{ border: '1px solid #22304a', padding: 12, borderRadius: 8 }}>
        <div style={{ opacity: 0.7, marginBottom: 8 }}>Status distribution</div>
        {Object.keys(dist).length === 0 ? (
          <div style={{ opacity: 0.7 }}>No data</div>
        ) : (
          <ul>
            {Object.entries(dist).map(([code, count]) => (
              <li key={code}>
                <strong>{code}</strong>: {count}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


