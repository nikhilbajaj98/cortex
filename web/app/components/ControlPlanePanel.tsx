'use client';

import { useState, useEffect } from 'react';
import {
  getControlPlaneDecisionsClient,
  ControlPlaneDecision,
} from '../../lib/api';

const DECISION_COLORS: Record<string, string> = {
  SCALE_UP: '#10b981',
  SCALE_DOWN: '#3b82f6',
  RESTART_PODS: '#f59e0b',
  CIRCUIT_BREAK: '#ef4444',
  NO_ACTION: '#6b7280',
};

const DECISION_ICONS: Record<string, string> = {
  SCALE_UP: '📈',
  SCALE_DOWN: '📉',
  RESTART_PODS: '🔄',
  CIRCUIT_BREAK: '🔒',
  NO_ACTION: '✓',
};

export default function ControlPlanePanel({ timeWindow = '5m' }: { timeWindow?: string }) {
  const [decisions, setDecisions] = useState<ControlPlaneDecision[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDecisions = async () => {
    setLoading(true);
    try {
      const data = await getControlPlaneDecisionsClient(timeWindow);
      setDecisions(data);
    } catch (error) {
      console.error('Failed to fetch decisions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
    const interval = setInterval(fetchDecisions, 5000);
    return () => clearInterval(interval);
  }, [timeWindow]);

  if (loading && decisions.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}>
            🎯
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Control Plane Decisions</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}>
            🎯
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Control Plane Decisions</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
              No active decisions. All services are healthy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          🎯
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Control Plane Decisions</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            {decisions.length} {decisions.length === 1 ? 'decision' : 'decisions'} active
          </p>
        </div>
      </div>
      
      <div style={{ display: 'grid', gap: 16 }}>
        {decisions.map((decision) => {
          const color = DECISION_COLORS[decision.decisionType] || '#6b7280';
          const icon = DECISION_ICONS[decision.decisionType] || '•';
          const healthColor = decision.metrics.healthScore >= 80 ? '#10b981' :
                              decision.metrics.healthScore >= 50 ? '#f59e0b' : '#ef4444';

          return (
            <div
              key={decision.serviceName}
              style={{
                border: `2px solid ${color}`,
                borderRadius: 16,
                padding: 20,
                background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>{icon}</span>
                    <strong style={{ fontSize: 18, fontWeight: 700 }}>{decision.serviceName}</strong>
                    <span className="badge" style={{
                      background: color,
                      color: 'white',
                      fontSize: 11,
                      padding: '4px 10px',
                    }}>
                      {decision.decisionType}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280', marginLeft: 36 }}>
                    {decision.action.description}
                  </div>
                </div>
                <div style={{ 
                  textAlign: 'right',
                  padding: '12px 16px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: 12,
                  minWidth: 100,
                }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
                    Confidence
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color }}>{decision.confidence}%</div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                padding: 16,
                background: '#f9fafb',
                borderRadius: 12,
                marginBottom: 16,
              }}>
                <MetricBox 
                  label="p95 Latency" 
                  value={`${decision.metrics.p95Latency.toFixed(0)}ms`}
                  color="#6366f1"
                />
                <MetricBox 
                  label="Error Rate" 
                  value={`${(decision.metrics.errorRate * 100).toFixed(1)}%`}
                  color={decision.metrics.errorRate > 0.05 ? '#ef4444' : '#10b981'}
                />
                <MetricBox 
                  label="Health Score" 
                  value={`${decision.metrics.healthScore.toFixed(0)}/100`}
                  color={healthColor}
                />
                <MetricBox 
                  label="Throughput" 
                  value={`${decision.metrics.throughput.toFixed(1)}/min`}
                  color="#3b82f6"
                />
              </div>

              {decision.action.currentPods !== undefined && (
                <div style={{ 
                  marginBottom: 12, 
                  padding: 12,
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  borderRadius: 8,
                  fontSize: 14,
                }}>
                  <strong style={{ color: '#1e40af' }}>Action:</strong>{' '}
                  <span style={{ color: '#374151' }}>
                    Scale from {decision.action.currentPods} → {decision.action.targetPods} pods
                  </span>
                  {decision.action.estimatedRecoveryTime && (
                    <span style={{ color: '#6b7280', marginLeft: 8 }}>
                      (Est. recovery: {Math.floor(decision.action.estimatedRecoveryTime / 60)}m {decision.action.estimatedRecoveryTime % 60}s)
                    </span>
                  )}
                </div>
              )}

              {decision.reasoning.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
                    Reasoning:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 24, fontSize: 13, color: '#374151' }}>
                    {decision.reasoning.map((reason, idx) => (
                      <li key={idx} style={{ marginBottom: 6 }}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}
