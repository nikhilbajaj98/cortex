'use client';

import { useState, useEffect } from 'react';

interface DemoModeToggleProps {
  onToggle: (enabled: boolean) => void;
}

export default function DemoModeToggle({ onToggle }: DemoModeToggleProps) {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    // Load demo mode state from localStorage
    const saved = localStorage.getItem('demoMode');
    if (saved === 'true') {
      setDemoMode(true);
      onToggle(true);
    }
  }, [onToggle]);

  const handleToggle = () => {
    const newValue = !demoMode;
    setDemoMode(newValue);
    localStorage.setItem('demoMode', newValue.toString());
    onToggle(newValue);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        cursor: 'pointer',
        color: '#ffffff',
      }}>
        <div style={{ position: 'relative' }}>
          <input
            type="checkbox"
            checked={demoMode}
            onChange={handleToggle}
            style={{ 
              width: 0,
              height: 0,
              opacity: 0,
              position: 'absolute',
            }}
          />
          <div style={{
            width: 48,
            height: 24,
            borderRadius: 12,
            background: demoMode ? '#10b981' : '#4b5563',
            position: 'relative',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            boxShadow: demoMode ? '0 0 0 3px rgba(16, 185, 129, 0.2)' : 'none',
          }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#ffffff',
              position: 'absolute',
              top: 2,
              left: demoMode ? 26 : 2,
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }} />
          </div>
        </div>
        <div>
          <div style={{ 
            fontWeight: 600, 
            fontSize: 14,
            color: '#ffffff',
            marginBottom: 2,
          }}>
            🎬 Demo Mode
          </div>
          <div style={{ 
            fontSize: 11,
            color: '#9ca3af',
          }}>
            {demoMode ? 'Active' : 'Inactive'}
          </div>
        </div>
      </label>
    </div>
  );
}


