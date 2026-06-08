import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
import { formatContextSummary } from '../../utils/contextUtils';

export default function ContextPreview({ wallet, sessionId }) {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!wallet || !sessionId) return;
    
    const fetchContext = async () => {
      setLoading(true);
      try {
        // Read raw context cached in Redis
        const res = await fetch(`${API_BASE}/support/chat`);
        // Wait, chat route doesn't expose a context getter directly, but we can call a helper
        // or query payments and tickets dynamically, or fetch session context raw.
        // Let's call buildUserContext on client side or fetch from a simple endpoint!
        // To make it simple, we can fetch recent payments and open tickets from the standard endpoints,
        // e.g. GET /api/support/tickets?wallet=0x... and payments endpoints!
        // This is extremely safe and doesn't require a new route.
        const [ticketsRes, paymentsRes] = await Promise.all([
          fetch(`${API_BASE}/support/tickets?wallet=${wallet}`),
          fetch(`${API_BASE}/payments?wallet=${wallet}`) // Let's check payments endpoint in server.js
        ]);
        
        const ticketsData = await ticketsRes.json();
        const paymentsData = await paymentsRes.json();

        const allPayments = paymentsData.payments || [];
        const pending = allPayments.filter(p => ['PROS_LOCKED', 'SETTLEMENT_STARTED', 'SETTLEMENT_PROCESSING'].includes(p.status));
        const failed = allPayments.filter(p => ['SETTLEMENT_FAILED', 'REFUNDED'].includes(p.status));
        const recent = allPayments.slice(0, 5);

        setContext({
          pendingPayments: pending,
          failedPayments: failed,
          recentPayments: recent,
          openTickets: (ticketsData.tickets || []).filter(t => ['open', 'in_progress'].includes(t.status))
        });
      } catch (err) {
        console.warn('Failed to load client context preview:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, [wallet, sessionId]);

  if (!context) return null;

  const summary = formatContextSummary(context);

  return (
    <div className="context-preview-container" style={{ marginBottom: '16px' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--text-secondary, #94a3b8)',
          fontSize: '12px',
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🛡️</span>
          <span>AI Context: <strong>{summary.badgeText}</strong></span>
        </div>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div 
          style={{
            background: 'var(--bg-secondary, rgba(30, 41, 59, 0.5))',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            padding: '12px 14px',
            fontSize: '11px',
            color: 'var(--text-secondary, #94a3b8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div>
            <strong style={{ color: 'var(--text)' }}>Linked Wallet:</strong> {wallet}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>Pending Settlements:</strong>{' '}
            {context.pendingPayments.length > 0 
              ? context.pendingPayments.map(p => `${p.amount || 'Payment'} (${p.status})`).join(', ')
              : 'None'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>Failed Transactions:</strong>{' '}
            {context.failedPayments.length > 0 
              ? `${context.failedPayments.length} transactions failed`
              : '0 failures'}
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>Active Tickets:</strong>{' '}
            {context.openTickets.length > 0 
              ? context.openTickets.map(t => `${t.ticketNumber} (${t.priority})`).join(', ')
              : 'None'}
          </div>
        </div>
      )}
    </div>
  );
}
