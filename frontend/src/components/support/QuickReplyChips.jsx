import React from 'react';
import './support.css';
import { getQuickPrompts } from '../../utils/promptBuilder';

export default function QuickReplyChips({ onSelect, walletState }) {
  const prompts = getQuickPrompts(walletState);
  if (!prompts || prompts.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        paddingBottom: '2px',
      }}
    >
      {prompts.map((chip, idx) => (
        <button
          key={idx}
          className="quick-chip"
          onClick={() => onSelect(chip.value)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
