'use client';

import { useState, useEffect } from 'react';
import {
  getScenarioStatusClient,
  startScenarioClient,
  stopScenarioClient,
  pauseScenarioClient,
  resumeScenarioClient,
  ScenarioStatus,
} from '../../lib/api';

const SCENARIOS = [
  { id: 'normal-traffic', name: 'Normal Traffic', description: 'Steady, healthy traffic patterns', icon: '✅', color: '#10b981' },
  { id: 'latency-spike', name: 'Latency Spike', description: 'Gradual performance degradation', icon: '⏱️', color: '#f59e0b' },
  { id: 'error-storm', name: 'Error Storm', description: 'Sudden service failure', icon: '⚡', color: '#ef4444' },
  { id: 'traffic-surge', name: 'Traffic Surge', description: 'Sudden traffic increase', icon: '📈', color: '#3b82f6' },
  { id: 'multi-service-chaos', name: 'Multi-Service Chaos', description: 'Multiple services with mixed health states', icon: '🌀', color: '#8b5cf6' },
];

export default function ScenarioControlPanel() {
  const [status, setStatus] = useState<ScenarioStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    const currentStatus = await getScenarioStatusClient();
    setStatus(currentStatus);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (scenarioId: string) => {
    setLoading(true);
    try {
      const newStatus = await startScenarioClient(scenarioId);
      if (newStatus) {
        setStatus(newStatus);
      }
    } catch (error) {
      console.error('Failed to start scenario:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!status?.currentScenario) return;
    setLoading(true);
    try {
      const newStatus = await stopScenarioClient(status.currentScenario);
      if (newStatus) {
        setStatus(newStatus);
      }
    } catch (error) {
      console.error('Failed to stop scenario:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!status?.currentScenario) return;
    setLoading(true);
    try {
      const newStatus = await pauseScenarioClient(status.currentScenario);
      if (newStatus) {
        setStatus(newStatus);
      }
    } catch (error) {
      console.error('Failed to pause scenario:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!status?.currentScenario) return;
    setLoading(true);
    try {
      const newStatus = await resumeScenarioClient(status.currentScenario);
      if (newStatus) {
        setStatus(newStatus);
      }
    } catch (error) {
      console.error('Failed to resume scenario:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentScenario = SCENARIOS.find(s => s.id === status?.currentScenario);

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
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          🎬
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Demo Scenarios</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#6b7280' }}>
            Simulate realistic production scenarios
          </p>
        </div>
      </div>
      
      {status?.isRunning && (
        <div style={{
          padding: 20,
          marginBottom: 24,
          borderRadius: 16,
          background: status.isPaused 
            ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' 
            : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
          border: `2px solid ${status.isPaused ? '#f59e0b' : '#10b981'}`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>
                  {status.isPaused ? '⏸️' : '▶️'}
                </span>
                <strong style={{ fontSize: 18, fontWeight: 700 }}>
                  {status.isPaused ? 'Paused' : 'Running'}: {currentScenario?.name || status.currentScenario}
                </strong>
              </div>
              <div style={{ 
                fontSize: 13, 
                color: '#6b7280',
                marginLeft: 36,
              }}>
                {currentScenario?.description}
              </div>
            </div>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.6)',
              borderRadius: 12,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
                Elapsed
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
                {formatTime(status.elapsedTime)}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                {status.eventsGenerated.toLocaleString()} events
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {status.isPaused ? (
              <button
                onClick={handleResume}
                disabled={loading}
                className="btn btn-success"
                style={{ fontSize: 14 }}
              >
                ▶ Resume
              </button>
            ) : (
              <button
                onClick={handlePause}
                disabled={loading}
                className="btn btn-warning"
                style={{ fontSize: 14 }}
              >
                ⏸ Pause
              </button>
            )}
            <button
              onClick={handleStop}
              disabled={loading}
              className="btn btn-danger"
              style={{ fontSize: 14 }}
            >
              ⏹ Stop
            </button>
          </div>
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: 16 
      }}>
        {SCENARIOS.map((scenario) => {
          const isActive = status?.currentScenario === scenario.id;
          const isDisabled = loading || (status?.isRunning && !isActive);
          
          return (
            <button
              key={scenario.id}
              onClick={() => !isDisabled && handleStart(scenario.id)}
              disabled={isDisabled}
              style={{
                padding: 20,
                border: `2px solid ${isActive ? scenario.color : '#e5e7eb'}`,
                borderRadius: 16,
                background: isActive 
                  ? `linear-gradient(135deg, ${scenario.color}15 0%, ${scenario.color}08 100%)`
                  : 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: isDisabled ? 0.6 : 1,
                transition: 'all 0.3s',
                boxShadow: isActive ? `0 4px 12px ${scenario.color}40` : '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
              onMouseEnter={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 8px 20px ${scenario.color}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isActive 
                    ? `0 4px 12px ${scenario.color}40` 
                    : '0 2px 8px rgba(0, 0, 0, 0.05)';
                }
              }}
              title={scenario.description}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12,
                marginBottom: 12,
              }}>
                <span style={{ fontSize: 32 }}>{scenario.icon}</span>
                <div>
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: 16,
                    marginBottom: 4,
                    color: '#111827',
                  }}>
                    {scenario.name}
                  </div>
                  <div style={{ 
                    fontSize: 12, 
                    color: '#6b7280',
                  }}>
                    {scenario.description}
                  </div>
                </div>
              </div>
              {isActive && (
                <div style={{
                  marginTop: 12,
                  padding: '6px 12px',
                  background: scenario.color,
                  color: 'white',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: 'center',
                }}>
                  ACTIVE
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
