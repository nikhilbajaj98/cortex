'use client';

import { useState, useEffect } from 'react';
import { 
  getScenarioStatusClient, 
  ScenarioStatus,
  getControlPlaneDecisionsClient,
  getAnomaliesClient,
} from '../../lib/api';

interface FlowMetrics {
  eventsPerSecond: number;
  kafkaMessages: number;
  clickhouseInserts: number;
  anomaliesDetected: number;
  decisionsMade: number;
}

export default function ArchitectureFlow() {
  const [status, setStatus] = useState<ScenarioStatus | null>(null);
  const [metrics, setMetrics] = useState<FlowMetrics>({
    eventsPerSecond: 0,
    kafkaMessages: 0,
    clickhouseInserts: 0,
    anomaliesDetected: 0,
    decisionsMade: 0,
  });

  useEffect(() => {
    const fetchStatus = async () => {
      const [currentStatus, decisions, anomalies] = await Promise.all([
        getScenarioStatusClient(),
        getControlPlaneDecisionsClient('5m'),
        getAnomaliesClient(),
      ]);
      
      setStatus(currentStatus);
      
      if (currentStatus?.isRunning) {
        // Calculate events per second (events generated / elapsed time)
        const eps = currentStatus.elapsedTime > 0 
          ? currentStatus.eventsGenerated / currentStatus.elapsedTime 
          : 0;
        
        setMetrics({
          eventsPerSecond: eps,
          kafkaMessages: currentStatus.eventsGenerated,
          clickhouseInserts: currentStatus.eventsGenerated,
          anomaliesDetected: anomalies?.anomalies?.length || 0,
          decisionsMade: decisions?.length || 0,
        });
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!status?.isRunning) {
    return null;
  }

  return (
    <div className="card-gradient" style={{
      marginBottom: 24,
      animation: 'fadeIn 0.5s ease-in',
    }}>
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
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          🏗️
        </div>
        <div>
          <h3 style={{ 
            margin: 0, 
            fontSize: 24,
            fontWeight: 700,
            color: '#ffffff',
          }}>
            Real-Time Architecture Flow
          </h3>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: 14,
            opacity: 0.9,
          }}>
            Live system metrics and data flow visualization
          </p>
        </div>
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <FlowBox 
          label="Events/sec" 
          value={metrics.eventsPerSecond.toFixed(1)} 
          color="#10b981"
          icon="⚡"
        />
        <FlowBox 
          label="Kafka Messages" 
          value={metrics.kafkaMessages.toLocaleString()} 
          color="#3b82f6"
          icon="📨"
        />
        <FlowBox 
          label="ClickHouse Inserts" 
          value={metrics.clickhouseInserts.toLocaleString()} 
          color="#8b5cf6"
          icon="💾"
        />
        <FlowBox 
          label="Anomalies" 
          value={metrics.anomaliesDetected.toString()} 
          color="#ef4444"
          icon="⚠️"
        />
        <FlowBox 
          label="Decisions" 
          value={metrics.decisionsMade.toString()} 
          color="#f59e0b"
          icon="🎯"
        />
      </div>

      {/* Architecture Diagram */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        padding: 24,
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        backdropFilter: 'blur(10px)',
      }}>
        <Component name="Kong Gateway" active={true} icon="🚪" />
        <Arrow />
        <Component name="Ingest API" active={true} icon="📥" />
        <Arrow />
        <Component name="Kafka/Redpanda" active={true} icon="📨" />
        <Arrow />
        <Component name="Analytics Consumer" active={true} icon="⚙️" />
        <Arrow />
        <Component name="ClickHouse" active={true} icon="💾" />
        <Arrow />
        <Component name="Anomaly Detector" active={metrics.anomaliesDetected > 0} icon="🔍" />
        <Arrow />
        <Component name="Control Plane" active={metrics.decisionsMade > 0} icon="🎯" />
      </div>
    </div>
  );
}

function FlowBox({ label, value, color, icon }: { label: string; value: string; color: string; icon?: string }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.15)',
      padding: 20,
      borderRadius: 12,
      textAlign: 'center',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      transition: 'all 0.3s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
      e.currentTarget.style.transform = 'translateY(-4px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}
    >
      <div style={{ 
        fontSize: 24, 
        marginBottom: 8,
      }}>
        {icon}
      </div>
      <div style={{ 
        fontSize: 11, 
        opacity: 0.9, 
        marginBottom: 8,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: 32, 
        fontWeight: 700, 
        color,
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      }}>
        {value}
      </div>
    </div>
  );
}

function Component({ name, active, icon }: { name: string; active: boolean; icon: string }) {
  return (
    <div style={{
      padding: '12px 20px',
      background: active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)',
      border: `2px solid ${active ? '#10b981' : 'rgba(255, 255, 255, 0.3)'}`,
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      transition: 'all 0.3s',
      backdropFilter: 'blur(10px)',
    }}
    onMouseEnter={(e) => {
      if (active) {
        e.currentTarget.style.background = 'rgba(16, 185, 129, 0.4)';
        e.currentTarget.style.transform = 'scale(1.05)';
      }
    }}
    onMouseLeave={(e) => {
      if (active) {
        e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)';
        e.currentTarget.style.transform = 'scale(1)';
      }
    }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span>{name}</span>
      {active && (
        <span style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 12,
          height: 12,
          background: '#10b981',
          borderRadius: '50%',
          animation: 'pulse 2s infinite',
          boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
        }} />
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ 
      fontSize: 24, 
      color: 'rgba(255, 255, 255, 0.7)',
      animation: 'pulse 2s infinite',
    }}>
      →
    </div>
  );
}
