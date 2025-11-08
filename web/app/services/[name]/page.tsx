'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getServiceMetricsClient, getServiceTimeSeriesClient } from '../../../lib/api';

const TIME_WINDOWS = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
];

type ChartLine<T> = {
  key: keyof T;
  label: string;
  color: string;
};

type TimeSeriesPoint = {
  time: string;
  timestamp: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
};

function SimpleLineChart<T extends Record<string, number | string>>({
  data,
  lines,
  height = 200,
  unit,
}: {
  data: (T & { time: string })[];
  lines: ChartLine<T>[];
  height?: number;
  unit?: string;
}) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#666', fontStyle: 'italic' }}>No data for this period.</p>;
  }

  const numericLines = lines.filter((line) => typeof data[0][line.key] === 'number');
  const maxVal = useMemo(() => {
    const values = numericLines.flatMap((line) => data.map((point) => (typeof point[line.key] === 'number' ? (point[line.key] as number) : 0)));
    return values.length ? Math.max(...values) || 0 : 0;
  }, [data, numericLines]);

  const viewBoxWidth = Math.max(data.length - 1, 1) * 10 + 10;
  const step = data.length > 1 ? (viewBoxWidth - 10) / (data.length - 1) : 0;
  const topPadding = 5;
  const bottomPadding = 10;
  const chartHeight = 100 - topPadding - bottomPadding;

  return (
    <div>
      <svg
        viewBox={`0 0 ${viewBoxWidth} 100`}
        preserveAspectRatio="none"
        style={{ width: '100%', height }}
      >
        {/* baseline */}
        <line x1={0} y1={100 - bottomPadding} x2={viewBoxWidth} y2={100 - bottomPadding} stroke="#ddd" strokeWidth={0.5} />
        {/* midline */}
        <line x1={0} y1={topPadding + chartHeight / 2} x2={viewBoxWidth} y2={topPadding + chartHeight / 2} stroke="#eee" strokeWidth={0.5} strokeDasharray="2 2" />
        {numericLines.map((line) => {
          const path = data
            .map((point, idx) => {
              const value = typeof point[line.key] === 'number' ? (point[line.key] as number) : 0;
              const x = idx * step;
              const y = maxVal === 0 ? topPadding + chartHeight : topPadding + chartHeight - (value / maxVal) * chartHeight;
              return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ');

          return <path key={line.key as string} d={path} fill="none" stroke={line.color} strokeWidth={1.5} />;
        })}
        {numericLines.map((line) =>
          data.map((point, idx) => {
            const value = typeof point[line.key] === 'number' ? (point[line.key] as number) : 0;
            const x = idx * step;
            const y = maxVal === 0 ? topPadding + chartHeight : topPadding + chartHeight - (value / maxVal) * chartHeight;
            return <circle key={`${line.key as string}-${idx}`} cx={x} cy={y} r={0.8} fill={line.color} />;
          })
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginTop: 6 }}>
        {data.map((point, idx) => (
          <span key={idx} style={{ flex: 1, textAlign: idx === 0 ? 'left' : idx === data.length - 1 ? 'right' : 'center' }}>
            {point.time}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: 12, color: '#555' }}>
        {numericLines.map((line) => {
          const latest = data[data.length - 1];
          const value = (latest[line.key] as number) ?? 0;
          return (
            <span key={line.key as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, backgroundColor: line.color, borderRadius: 4, display: 'inline-block' }} />
              {line.label}: {value.toFixed( unit ? 2 : 0)}{unit}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function StackedBarList({
  data,
  successColor = '#82ca9d',
  failedColor = '#ff6b6b',
}: {
  data: TimeSeriesPoint[];
  successColor?: string;
  failedColor?: string;
}) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#666', fontStyle: 'italic' }}>No data for this period.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {data.map((point) => {
        const total = point.successfulRequests + point.failedRequests;
        const successPct = total === 0 ? 0 : (point.successfulRequests / total) * 100;
        const failedPct = total === 0 ? 0 : (point.failedRequests / total) * 100;
        return (
          <div key={point.timestamp}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
              <span>{point.time}</span>
              <span>{total} total</span>
            </div>
            <div style={{ height: 10, background: '#f2f2f2', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${successPct}%`, background: successColor, height: '100%', display: 'inline-block' }} />
              <div style={{ width: `${failedPct}%`, background: failedColor, height: '100%', display: 'inline-block' }} />
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#555', marginTop: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: successColor, borderRadius: 4, display: 'inline-block' }} /> Successful
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: failedColor, borderRadius: 4, display: 'inline-block' }} /> Failed
        </span>
      </div>
    </div>
  );
}

function ServiceDetailContent({ params }: { params: { name: string } }) {
  const searchParams = useSearchParams();
  const svc = decodeURIComponent(params.name);
  const [data, setData] = useState<any>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[] | null>(null);
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

  const fetchTimeSeries = async (window: string) => {
    try {
      // Calculate time range based on window
      const now = new Date();
      let startTime: Date;
      let granularity: '1m' | '5m' | '15m' | '1h' = '5m';
      
      if (window === '5m') {
        startTime = new Date(now.getTime() - 5 * 60 * 1000);
        granularity = '1m';
      } else if (window === '15m') {
        startTime = new Date(now.getTime() - 15 * 60 * 1000);
        granularity = '5m';
      } else if (window === '1h') {
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        granularity = '5m';
      } else {
        startTime = new Date(now.getTime() - 5 * 60 * 1000);
      }

      const result = await getServiceTimeSeriesClient(
        svc,
        startTime.toISOString(),
        now.toISOString(),
        granularity
      );
      
      if (result?.data) {
        const chartData: TimeSeriesPoint[] = result.data.map((point: any) => {
          const ts = new Date(point.window_start.replace(' ', 'T') + 'Z');
          return {
            time: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: ts.getTime(),
            p50: Number(point.p50_latency) || 0,
            p95: Number(point.p95_latency) || 0,
            p99: Number(point.p99_latency) || 0,
            errorRate: Number(point.error_rate) || 0,
            throughput: Number(point.throughput) || 0,
            totalRequests: Number(point.total_requests) || 0,
            successfulRequests: Number(point.successful_requests) || 0,
            failedRequests: Number(point.failed_requests) || 0,
          };
        });

        setTimeSeriesData(chartData.sort((a, b) => a.timestamp - b.timestamp));
      }
    } catch (err: any) {
      console.error('Failed to load time series:', err);
      // Don't set error, just log it - time series is optional
    }
  };

  useEffect(() => {
    fetchData(timeWindow);
    fetchTimeSeries(timeWindow);
    
    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchData(timeWindow);
      fetchTimeSeries(timeWindow);
    }, 5000);
    
    return () => clearInterval(interval);
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
        <div style={{ display: 'grid', gap: 24 }}>
          <div>
            <h3>Snapshot ({timeWindow})</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Stat label="Total Requests" value={m?.totalRequests ?? 0} />
              <Stat label="Error Rate" value={`${(m?.errorRate ?? 0).toFixed(2)}%`} />
              <Stat label="Latency p50" value={`${m?.p50Latency ?? '-'} ms`} />
              <Stat label="Latency p95" value={`${m?.p95Latency ?? '-'} ms`} />
              <Stat label="Latency p99" value={`${m?.p99Latency ?? '-'} ms`} />
              <Stat label="Avg Latency" value={`${Math.round(m?.averageLatency ?? 0)} ms`} />
            </div>
          </div>

          {timeSeriesData && timeSeriesData.length > 0 && (
            <>
              <div>
                <h3>Latency Over Time</h3>
                <SimpleLineChart<TimeSeriesPoint>
                  data={timeSeriesData}
                  lines={[
                    { key: 'p50', label: 'p50', color: '#8884d8' },
                    { key: 'p95', label: 'p95', color: '#82ca9d' },
                    { key: 'p99', label: 'p99', color: '#ff7300' },
                  ]}
                  height={240}
                  unit=" ms"
                />
              </div>

              <div>
                <h3>Error Rate Over Time</h3>
                <SimpleLineChart<TimeSeriesPoint>
                  data={timeSeriesData}
                  lines={[{ key: 'errorRate', label: 'Error Rate', color: '#ff6b6b' }]}
                  height={200}
                  unit=" %"
                />
              </div>

              <div>
                <h3>Throughput Over Time</h3>
                <SimpleLineChart<TimeSeriesPoint>
                  data={timeSeriesData}
                  lines={[{ key: 'throughput', label: 'Throughput', color: '#00aaff' }]}
                  height={200}
                  unit=" req/s"
                />
              </div>

              <div>
                <h3>Request Status Distribution</h3>
                <StackedBarList data={timeSeriesData} />
              </div>
            </>
          )}

          <div>
            <h3>Status Distribution (Current Window)</h3>
            {agg?.statusDistribution ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {Object.entries(agg.statusDistribution as Record<string, number | string>).map(([status, count]) => {
                  const numericCount = typeof count === 'number' ? count : Number(count) || 0;
                  const total = agg.totalRequests || m?.totalRequests || 0;
                  const pct = total === 0 ? 0 : Math.round((numericCount / total) * 100);
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                        <span>Status {status}</span>
                        <span>{numericCount} ({pct}%)</span>
                      </div>
                      <div style={{ height: 10, background: '#f2f2f2', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: '#8884d8', height: '100%' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <pre style={{ background: '#fafafa', border: '1px solid #eee', padding: 12 }}>
                {JSON.stringify(agg?.statusDistribution ?? {}, null, 2)}
              </pre>
            )}
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
