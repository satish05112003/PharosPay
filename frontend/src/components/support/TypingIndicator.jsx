import React from 'react';

export default function TypingIndicator() {
  return (
    <div 
      className="typing-indicator" 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'var(--bg-secondary, rgba(255, 255, 255, 0.05))',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
        borderRadius: '12px 12px 12px 4px',
        padding: '10px 14px',
        marginBottom: '16px',
        maxWidth: '80px'
      }}
    >
      <span 
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'var(--text-secondary, #94a3b8)',
          animation: 'bounce 1.4s infinite ease-in-out both',
          animationDelay: '-0.32s'
        }}
      />
      <span 
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'var(--text-secondary, #94a3b8)',
          animation: 'bounce 1.4s infinite ease-in-out both',
          animationDelay: '-0.16s'
        }}
      />
      <span 
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'var(--text-secondary, #94a3b8)',
          animation: 'bounce 1.4s infinite ease-in-out both'
        }}
      />
    </div>
  );
}
