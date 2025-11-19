'use client';

import { useState } from 'react';
import DemoModeToggle from './DemoModeToggle';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoMode] = useState(false);

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    }}>
      <aside style={{ 
        width: 280, 
        padding: '32px 24px',
        background: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
        color: '#ffffff',
        boxShadow: '4px 0 20px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: 28,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px',
          }}>
            Cortex
          </h1>
          <p style={{ 
            margin: '8px 0 0 0',
            fontSize: 13,
            color: '#9ca3af',
            fontWeight: 500,
          }}>
            Autonomous Control Plane
          </p>
        </div>
        
        <nav style={{ 
          display: 'grid', 
          gap: 4, 
          marginBottom: 32,
        }}>
          <a 
            href="/" 
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#d1d5db',
              fontSize: 15,
              fontWeight: 500,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#d1d5db';
            }}
          >
            <span>📊</span> Dashboard
          </a>
          <a 
            href="/services" 
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#d1d5db',
              fontSize: 15,
              fontWeight: 500,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#d1d5db';
            }}
          >
            <span>⚙️</span> Services
          </a>
        </nav>
        
        <div style={{
          padding: '20px 16px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <DemoModeToggle onToggle={setDemoMode} />
        </div>
      </aside>
      
      <main style={{ 
        flex: 1, 
        padding: '32px 40px',
        maxWidth: '100%',
        overflowX: 'auto',
      }}>
        {typeof window !== 'undefined' && (
          <div data-demo-mode={demoMode} style={{ display: 'none' }} />
        )}
        {children}
      </main>
    </div>
  );
}


