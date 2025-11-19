'use client';

import { useState, useEffect } from 'react';
import { getControlPlaneDecisionsClient, ControlPlaneDecision } from '../../lib/api';

interface TimelineDecision extends ControlPlaneDecision {
  id: string;
  displayTime: string;
}

export default function DecisionTimeline({ timeWindow = '5m' }: { timeWindow?: string }) {
  const [decisions, setDecisions] = useState<TimelineDecision[]>([]);

  useEffect(() => {
    const fetchDecisions = async () => {
      const data = await getControlPlaneDecisionsClient(timeWindow);
      
      // Convert to timeline format with IDs and display times
      const timelineDecisions: TimelineDecision[] = data.map((d, idx) => ({
        ...d,
        id: `${d.serviceName}-${d.timestamp}-${idx}`,
        displayTime: new Date(d.timestamp).toLocaleTimeString(),
      }));
      
      // Keep only recent decisions (last 10)
      setDecisions(timelineDecisions.slice(-10).reverse());
    };

    fetchDecisions();
    const interval = setInterval(fetchDecisions, 5000);
    return () => clearInterval(interval);
  }, [timeWindow]);

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
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}>
            📊
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Decision Timeline</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
              No decisions made yet. Start a scenario to see autonomous decisions.
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
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          📊
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Decision Timeline</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            Chronological view of control plane decisions
          </p>
        </div>
      </div>
      
      <div style={{ position: 'relative', paddingLeft: 32 }}>
        {/* Timeline line */}
        <div style={{
          position: 'absolute',
          left: 12,
          top: 0,
          bottom: 0,
          width: 3,
          background: 'linear-gradient(180deg, #8b5cf6 0%, #6366f1 50%, #10b981 100%)',
          borderRadius: 2,
        }} />
        
        {decisions.map((decision, idx) => (
          <TimelineItem key={decision.id} decision={decision} isLast={idx === decisions.length - 1} />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({ decision, isLast }: { decision: TimelineDecision; isLast: boolean }) {
  const colorMap: Record<string, string> = {
    SCALE_UP: '#10b981',
    SCALE_DOWN: '#3b82f6',
    RESTART_PODS: '#f59e0b',
    CIRCUIT_BREAK: '#ef4444',
    NO_ACTION: '#6b7280',
  };

  const iconMap: Record<string, string> = {
    SCALE_UP: '📈',
    SCALE_DOWN: '📉',
    RESTART_PODS: '🔄',
    CIRCUIT_BREAK: '🔒',
    NO_ACTION: '✓',
  };

  const color = colorMap[decision.decisionType] || '#6b7280';
  const icon = iconMap[decision.decisionType] || '•';

  return (
    <div style={{
      position: 'relative',
      marginBottom: isLast ? 0 : 24,
      paddingLeft: 24,
      animation: 'slideIn 0.5s ease-out',
    }}>
      {/* Timeline dot */}
      <div style={{
        position: 'absolute',
        left: -20,
        top: 8,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: color,
        border: '3px solid white',
        boxShadow: `0 0 0 3px ${color}40, 0 4px 12px ${color}60`,
        zIndex: 10,
      }} />
      
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
        border: `2px solid ${color}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(8px)';
        e.currentTarget.style.boxShadow = `0 8px 20px ${color}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
      }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <strong style={{ fontSize: 16, fontWeight: 700 }}>{decision.serviceName}</strong>
              <span className="badge" style={{
                background: color,
                color: 'white',
                fontSize: 10,
                padding: '3px 8px',
              }}>
                {decision.decisionType}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginLeft: 32 }}>
              {decision.action.description}
            </div>
          </div>
          <div style={{ 
            textAlign: 'right',
            padding: '8px 12px',
            background: 'rgba(99, 102, 241, 0.1)',
            borderRadius: 8,
            minWidth: 80,
          }}>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2, fontWeight: 500 }}>
              {decision.displayTime}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{decision.confidence}%</div>
          </div>
        </div>
        
        {decision.action.currentPods !== undefined && (
          <div style={{
            fontSize: 13,
            padding: 12,
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            borderRadius: 8,
            marginTop: 12,
          }}>
            <strong style={{ color: '#1e40af' }}>Action:</strong>{' '}
            <span style={{ color: '#374151' }}>
              Scale from {decision.action.currentPods} → {decision.action.targetPods} pods
            </span>
            {decision.action.estimatedRecoveryTime && (
              <span style={{ color: '#6b7280', marginLeft: 8 }}>
                (Est. recovery: {Math.floor(decision.action.estimatedRecoveryTime / 60)}m)
              </span>
            )}
          </div>
        )}
        
        {decision.reasoning.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#555' }}>
            <strong style={{ color: '#374151' }}>Reasoning:</strong>
            <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
              {decision.reasoning.map((reason, idx) => (
                <li key={idx} style={{ marginBottom: 4, color: '#6b7280' }}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
