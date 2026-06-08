import React from 'react';
import { getQuickPrompts } from '../../utils/promptBuilder';

export default function QuickReplyChips({ onSelect, walletState }) {
  const prompts = getQuickPrompts(walletState);

  return (
    <div 
      className="quick-reply-chips" 
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '16px'
      }}
    >
      {prompts.map((chip, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(chip.value)}
          style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '16px',
            padding: '6px 12px',
            color: 'var(--primary, #6366f1)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
          }}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
