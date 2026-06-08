import React, { useState } from 'react';

export default function PromptSuggestions({ wallet, onSelect }) {
  const [activeTab, setActiveTab] = useState('payments');

  const categories = {
    payments: {
      label: '💰 Payments',
      items: [
        { title: 'Check latest payment', query: 'Show my latest payment' },
        { title: 'Find payment receipt', query: 'How can I find the receipt for my last transaction?' },
        { title: 'Verify transaction hash', query: 'Can you help me verify my transaction hash?' },
        { title: 'View settlement details', query: 'Where is my settlement processing?' },
        { title: 'Find UTR number', query: 'How do I locate the UTR reference number for my payment?' }
      ]
    },
    support: {
      label: '🛠️ Support',
      items: [
        { title: 'Open support ticket', query: 'I would like to open a support ticket' },
        { title: 'Contact support team', query: 'How can I contact the official support team?' },
        { title: 'Escalate issue', query: 'I want to escalate my payment issue to a human agent' }
      ]
    },
    pharos: {
      label: '🤖 Pharos',
      items: [
        { title: 'What is Pharos?', query: 'What is Pharos?' },
        { title: 'Open official documentation', query: 'Where can I read the official Pharos documentation?' },
        { title: 'View explorer', query: 'What is the Pharos scan explorer URL?' },
        { title: 'Latest ecosystem updates', query: 'What are the latest announcements and ecosystem projects on Pharos?' }
      ]
    },
    merchant: {
      label: '💼 Merchant',
      items: [
        { title: 'Merchant dashboard help', query: 'How do I onboarding my merchant profile in Merchant OS?' },
        { title: 'Merchant settlement status', query: 'What is my merchant settlement status?' }
      ]
    },
    wallet: {
      label: '🔑 Wallet',
      items: [
        { title: 'Show wallet activity', query: 'Show my wallet activity' },
        { title: 'View recent transactions', query: 'Show my recent transactions' }
      ]
    }
  };

  return (
    <div className="prompt-suggestions-container" style={{ margin: '16px 0' }}>
      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))', marginBottom: '12px' }}>
        {Object.entries(categories).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '6px 12px',
              borderRadius: '16px',
              border: activeTab === key ? '1px solid var(--primary, #6366f1)' : '1px solid transparent',
              background: activeTab === key ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
              color: activeTab === key ? 'var(--primary, #6366f1)' : 'var(--text-secondary, #94a3b8)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Suggestion Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {categories[activeTab].items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(item.query)}
            style={{
              background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              borderRadius: '10px',
              padding: '10px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary, rgba(255, 255, 255, 0.03))';
              e.currentTarget.style.borderColor = 'var(--border, rgba(255, 255, 255, 0.08))';
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text, #ffffff)' }}>
              {item.title}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary, #94a3b8)', marginTop: '2px' }}>
              Click to ask
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
