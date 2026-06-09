import React from 'react';
import './support.css';

export default function HumanHandoffBanner({ status, message }) {
  if (status === 'AI_ONLY' || !message) return null;

  const isActive = status === 'HUMAN_ACTIVE';

  return (
    <div
      className="handoff-banner"
      style={{
        background: isActive ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
        border: `1px solid ${isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
        color: isActive ? '#4ade80' : '#fbbf24',
      }}
    >
      <div
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: isActive ? '#22c55e' : '#f59e0b',
          flexShrink: 0,
          boxShadow: isActive
            ? '0 0 6px rgba(34, 197, 94, 0.5)'
            : '0 0 6px rgba(245, 158, 11, 0.5)',
          animation: 'pulse-dot 2s ease-in-out infinite',
        }}
      />
      <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, lineHeight: 1.4 }}>
        {message}
      </span>
    </div>
  );
}
