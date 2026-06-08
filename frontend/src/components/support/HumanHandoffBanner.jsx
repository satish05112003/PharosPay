import React from 'react';

export default function HumanHandoffBanner({ status, message }) {
  if (status === 'AI_ONLY') return null;

  const isActive = status === 'HUMAN_ACTIVE';

  return (
    <div 
      className="handoff-banner" 
      style={{
        background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
        border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: isActive ? '#10b981' : '#f59e0b',
        fontSize: '13px',
        fontWeight: 500
      }}
    >
      <div 
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: isActive ? '#10b981' : '#f59e0b',
          animation: 'pulse 1.5s infinite'
        }}
      />
      <span style={{ flex: 1 }}>{message}</span>
    </div>
  );
}
