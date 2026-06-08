import React from 'react';
import { getSeverityStyle } from '../../utils/severityUtils';

export default function SeverityIndicator({ severity, confidence }) {
  const style = getSeverityStyle(severity);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <span 
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        {severity}
      </span>

      {confidence !== undefined && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary, #94a3b8)' }}>
          <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${confidence * 100}%`, 
                height: '100%', 
                background: style.text,
                transition: 'width 0.3s ease' 
              }} 
            />
          </div>
          <span>{(confidence * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
