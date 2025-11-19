'use client';

import { useState } from 'react';
import { startScenarioClient } from '../../lib/api';

interface Incident {
  id: string;
  name: string;
  description: string;
  scenario: string;
  duration: string;
  impact: string;
  solution: string;
  icon: string;
  color: string;
}

const INCIDENTS: Incident[] = [
  {
    id: 'db-pool-exhaustion',
    name: 'Database Connection Pool Exhaustion',
    description: 'Gradual degradation as connection pool fills up, causing latency spikes and timeouts',
    scenario: 'latency-spike',
    duration: '3-5 minutes',
    impact: 'Latency increases from 50ms to 500ms+, errors start appearing',
    solution: 'Cortex detects pattern, scales up pods to distribute load, restarts unhealthy connections',
    icon: '💾',
    color: '#f59e0b',
  },
  {
    id: 'cascading-failure',
    name: 'Cascading Service Failure',
    description: 'Service A fails, causing Service B to get overloaded, triggering a cascade',
    scenario: 'error-storm',
    duration: '2-3 minutes',
    impact: 'Error rate spikes to 30-40%, latency increases due to retries',
    solution: 'Cortex detects cascade, enables circuit breaker to isolate failure, prevents spread',
    icon: '⚡',
    color: '#ef4444',
  },
  {
    id: 'traffic-spike',
    name: 'Traffic Spike (Black Friday)',
    description: 'Sudden 10x increase in traffic, system struggles to handle load',
    scenario: 'traffic-surge',
    duration: '5-10 minutes',
    impact: 'Throughput spikes, latency increases, potential errors under load',
    solution: 'Cortex proactively scales up before metrics degrade, maintains performance',
    icon: '📈',
    color: '#3b82f6',
  },
  {
    id: 'memory-leak',
    name: 'Memory Leak Degradation',
    description: 'Gradual memory consumption increase causing performance degradation',
    scenario: 'latency-spike',
    duration: '5-7 minutes',
    impact: 'Gradual latency increase, eventual OOM errors, service restarts needed',
    solution: 'Cortex detects gradual pattern, restarts pods to clear memory, scales if needed',
    icon: '🧠',
    color: '#f59e0b',
  },
  {
    id: 'multi-service-chaos',
    name: 'Multi-Service Chaos',
    description: 'Multiple services experiencing different issues simultaneously',
    scenario: 'multi-service-chaos',
    duration: 'Ongoing',
    impact: 'Mixed health states across services, complex interdependencies',
    solution: 'Cortex orchestrates independent decisions per service, prevents cascading failures',
    icon: '🌀',
    color: '#8b5cf6',
  },
];

export default function IncidentSimulation() {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStartIncident = async (incident: Incident) => {
    setLoading(true);
    try {
      await startScenarioClient(incident.scenario);
      setSelectedIncident(incident);
    } catch (error) {
      console.error('Failed to start incident:', error);
    } finally {
      setLoading(false);
    }
  };

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
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          🚨
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Incident Simulation</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            Simulate realistic production incidents and watch Cortex autonomously respond
          </p>
        </div>
      </div>
      
      <div style={{ display: 'grid', gap: 16 }}>
        {INCIDENTS.map((incident) => {
          const isSelected = selectedIncident?.id === incident.id;
          
          return (
            <div
              key={incident.id}
              style={{
                border: `2px solid ${isSelected ? incident.color : '#e5e7eb'}`,
                borderRadius: 16,
                padding: 20,
                background: isSelected
                  ? `linear-gradient(135deg, ${incident.color}10 0%, ${incident.color}05 100%)`
                  : 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.3s',
                boxShadow: isSelected ? `0 4px 12px ${incident.color}40` : '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
              onClick={() => !loading && handleStartIncident(incident)}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 8px 20px ${incident.color}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isSelected 
                    ? `0 4px 12px ${incident.color}40` 
                    : '0 2px 8px rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 32 }}>{incident.icon}</span>
                    <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                      {incident.name}
                    </h4>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                    {incident.description}
                  </p>
                </div>
                <button
                  disabled={loading}
                  className="btn"
                  style={{
                    background: isSelected ? incident.color : '#e5e7eb',
                    color: isSelected ? 'white' : '#374151',
                    fontSize: 13,
                    padding: '10px 20px',
                    minWidth: 100,
                  }}
                >
                  {loading && isSelected ? 'Starting...' : 'Simulate'}
                </button>
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid #e5e7eb',
              }}>
                <InfoBox 
                  label="Duration" 
                  value={incident.duration}
                  icon="⏱️"
                />
                <InfoBox 
                  label="Impact" 
                  value={incident.impact}
                  icon="💥"
                  color="#ef4444"
                />
                <InfoBox 
                  label="Cortex Solution" 
                  value={incident.solution}
                  icon="✅"
                  color="#10b981"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoBox({ label, value, icon, color = '#6b7280' }: { 
  label: string; 
  value: string; 
  icon: string;
  color?: string;
}) {
  return (
    <div style={{
      padding: 12,
      background: '#f9fafb',
      borderRadius: 12,
    }}>
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: '#6b7280', 
        marginBottom: 8,
        fontSize: 12,
        fontWeight: 600,
      }}>
        <span>{icon}</span>
        {label}
      </div>
      <div style={{ 
        fontWeight: 600,
        fontSize: 13,
        color,
        lineHeight: 1.5,
      }}>
        {value}
      </div>
    </div>
  );
}
