import React from 'react';
import './support.css';
import { APP_CONFIG } from '../../config';

const QUICK_SUGGESTIONS = [
  {
    icon: '📍',
    title: 'Track My Settlement',
    desc: 'Check status of pending or recent payment settlements',
    query: 'Where is my settlement? Show me the status of my latest payment.',
  },
  {
    icon: '💸',
    title: 'Missing Funds',
    desc: 'Funds deducted but not received by merchant',
    query: 'My funds were deducted but the merchant did not receive the payment.',
  },
  {
    icon: '🧾',
    title: 'Verify Receipt',
    desc: 'Authenticate and validate a payment receipt',
    query: 'Help me verify the authenticity of my payment receipt.',
  },
  {
    icon: '🏦',
    title: 'Bank Transfer Issue',
    desc: 'Problems with UPI, PIX, ACH, or SEPA transfers',
    query: 'I have an issue with a bank transfer. The payment was not credited.',
  },
  {
    icon: '🔍',
    title: 'Find Transaction',
    desc: 'Look up a past payment by ID or hash',
    query: 'Can you help me find a specific transaction by its payment ID or hash?',
  },
  {
    icon: '⛓️',
    title: 'Pharos Ecosystem',
    desc: `Learn about Pharos blockchain, PROS tokens, and DeFi`,
    query: `Tell me about the Pharos ecosystem and how PROS tokens work.`,
  },
  {
    icon: '🛠️',
    title: 'Technical Support',
    desc: 'Wallet connection, smart contract, or app errors',
    query: 'I am experiencing a technical issue with the PharosPay application.',
  },
  {
    icon: '📈',
    title: `PROS Exchange Rate`,
    desc: `Check how live prices are calculated`,
    query: `What is the current PROS/USD rate and how is it calculated?`,
  },
];

export default function PromptSuggestions({ onSelect }) {
  return (
    <div style={{ marginTop: '12px' }}>
      <div className="suggestions-welcome">
        <div className="suggestions-welcome-title">How can Pharos Support help you?</div>
        <div className="suggestions-welcome-sub">
          Select a topic below or type your question directly
        </div>
      </div>

      <div className="suggestions-grid">
        {QUICK_SUGGESTIONS.map((item, idx) => (
          <button
            key={idx}
            className="suggestion-card"
            onClick={() => onSelect(item.query)}
          >
            <div className="suggestion-card-icon">{item.icon}</div>
            <div className="suggestion-card-title">{item.title}</div>
            <div className="suggestion-card-desc">{item.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
