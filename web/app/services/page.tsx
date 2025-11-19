'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getServicesClient, getAnomaliesClient } from '../../lib/api';
import ScenarioControlPanel from '../components/ScenarioControlPanel';
import ControlPlanePanel from '../components/ControlPlanePanel';
import ArchitectureFlow from '../components/ArchitectureFlow';
import DecisionTimeline from '../components/DecisionTimeline';
import IncidentSimulation from '../components/IncidentSimulation';

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
  const [demoMode, setDemoMode] = useState(false);

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
    // Auto-refresh every 3 seconds when demo mode is active
    if (demoMode) {
      const interval = setInterval(() => {
        fetchData(timeWindow);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [timeWindow, demoMode]);

  useEffect(() => {
    // Check demo mode from localStorage
    const checkDemoMode = () => {
      const saved = localStorage.getItem('demoMode');
      setDemoMode(saved === 'true');
    };
    checkDemoMode();
    const interval = setInterval(checkDemoMode, 500);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700 }}>Services</h1>
        <p style={{ color: '#6b7280', fontSize: 16 }}>Loading service metrics...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card" style={{ 
        textAlign: 'center', 
        padding: '48px',
        border: '2px solid #ef4444',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 28, fontWeight: 700 }}>Services</h1>
        <p style={{ color: '#ef4444', fontSize: 16, fontWeight: 500 }}>Error: {error}</p>
      </div>
    );
  }

  const services = data?.services ?? [];
  
  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 32,
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            fontSize: 36,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-1px',
          }}>
            Services
          </h1>
          <p style={{ 
            margin: '8px 0 0 0',
            color: '#6b7280',
            fontSize: 15,
          }}>
            Real-time monitoring and analytics for all microservices
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        }}>
          <label style={{ 
            fontSize: 14, 
            fontWeight: 500,
            color: '#374151',
          }}>
            Time Window:
          </label>
          <select 
            value={timeWindow} 
            onChange={(e) => setTimeWindow(e.target.value)}
            style={{ 
              padding: '6px 12px', 
              fontSize: 14,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: '#ffffff',
              color: '#111827',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {TIME_WINDOWS.map(tw => (
              <option key={tw.value} value={tw.value}>{tw.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Demo Components */}
      {demoMode && (
        <div style={{ 
          display: 'grid',
          gap: 24,
          marginBottom: 32,
        }}>
          <IncidentSimulation />
          <ArchitectureFlow />
          <ScenarioControlPanel />
          <DecisionTimeline timeWindow={timeWindow} />
          <ControlPlanePanel timeWindow={timeWindow} />
        </div>
      )}
      
      {/* Services Table */}
      {services.length === 0 ? (
        <div className="card" style={{ 
          padding: 48, 
          textAlign: 'center',
          background: 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)',
        }}>
          <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>📊</div>
          {demoMode ? (
            <div>
              <h3 style={{ 
                margin: '0 0 8px 0',
                fontSize: 20,
                fontWeight: 600,
                color: '#374151',
              }}>
                No services with activity
              </h3>
              <p style={{ 
                fontSize: 15, 
                color: '#6b7280',
                margin: '8px 0 0 0',
              }}>
                Start a demo scenario to see services appear here
              </p>
            </div>
          ) : (
            <div>
              <h3 style={{ 
                margin: '0 0 8px 0',
                fontSize: 20,
                fontWeight: 600,
                color: '#374151',
              }}>
                No services found
              </h3>
              <p style={{ 
                fontSize: 15, 
                color: '#6b7280',
                margin: '8px 0 0 0',
              }}>
                Generate some load or start a demo scenario
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ 
          padding: 0,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#ffffff',
          }}>
            <h2 style={{ 
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
            }}>
              Service Metrics
            </h2>
            <p style={{ 
              margin: '4px 0 0 0',
              fontSize: 13,
              opacity: 0.9,
            }}>
              {services.length} {services.length === 1 ? 'service' : 'services'} active
            </p>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr style={{
                  background: '#f9fafb',
                  borderBottom: '2px solid #e5e7eb',
                }}>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '16px 24px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Service
                  </th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '16px 24px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Latency p95
                  </th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '16px 24px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Error Rate
                  </th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '16px 24px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Requests
                  </th>
                  <th style={{ 
                    textAlign: 'left', 
                    padding: '16px 24px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((s: any, idx: number) => {
                  const isDemoService = demoMode && (
                    s.service.includes('payments') || 
                    s.service.includes('checkout') || 
                    s.service.includes('inventory') || 
                    s.service.includes('shipping') || 
                    s.service.includes('notifications') ||
                    s.service.includes('analytics')
                  );
                  const errorRate = s.metrics?.errorRate ?? 0;
                  const errorRatePct = typeof errorRate === 'number' ? (errorRate * 100).toFixed(2) : errorRate;
                  const hasAnomaly = anomalies[s.service];
                  
                  return (
                    <tr 
                      key={s.service} 
                      style={{ 
                        background: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDemoService ? '#eff6ff' : '#f3f4f6';
                        e.currentTarget.style.transform = 'scale(1.01)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Link 
                            href={`/services/${encodeURIComponent(s.service)}?timeWindow=${timeWindow}`}
                            style={{
                              color: '#111827',
                              textDecoration: 'none',
                              fontWeight: 600,
                              fontSize: 15,
                              transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#6366f1'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
                          >
                            {s.service}
                          </Link>
                          {isDemoService && (
                            <span className="badge badge-info" style={{
                              fontSize: 10,
                              padding: '2px 8px',
                            }}>
                              DEMO
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#111827',
                        }}>
                          {s.metrics?.p95Latency ? `${Math.round(s.metrics.p95Latency)}ms` : '-'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: errorRate > 0.05 ? '#ef4444' : '#111827',
                        }}>
                          {errorRatePct}%
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#6366f1',
                        }}>
                          {s.metrics?.totalRequests?.toLocaleString() ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {hasAnomaly ? (
                          <span className="badge badge-danger">
                            ⚠️ Anomaly
                          </span>
                        ) : (
                          <span className="badge badge-success">
                            ✓ Healthy
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
