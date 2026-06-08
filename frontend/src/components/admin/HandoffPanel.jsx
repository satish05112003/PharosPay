import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';

export default function HandoffPanel({ ticketId, onStatusChange, agentId = 'agent_alpha' }) {
  const [status, setStatus] = useState('AI_ONLY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkStatus = async () => {
    try {
      // Find active handoff for ticket in database
      const res = await fetch(`${API_BASE}/admin/support/tickets/${ticketId}/analysis`);
      // Or search ticket detail
      const ticketRes = await fetch(`${API_BASE}/support/tickets/${ticketId}`);
      const tData = await ticketRes.json();
      if (tData.success) {
        // Query human handoffs for this ticket
        const handoffCheck = await fetch(`${API_BASE}/admin/support/tickets/${ticketId}/escalations`);
        const hData = await handoffCheck.json();
        if (hData.success && hData.events.length > 0) {
          // If there is an active handoff event in DB
          const activeHandoff = hData.contacts.length > 0; // Check state or default
        }
      }
    } catch (err) {}
  };

  useEffect(() => {
    // Check if session status is handoff and if agent is active
    if (ticketId) {
      // We can also let parent pass the state, or query it. Let's write a simple status loader.
      const fetchStatus = async () => {
        try {
          const res = await fetch(`${API_BASE}/support/tickets/${ticketId}`);
          const data = await res.json();
          if (data.success && data.ticket) {
            // Find session linked to ticket
            const sessRes = await fetch(`${API_BASE}/support/sessions/wallet/${data.ticket.userWallet}`);
            const sessData = await sessRes.json();
            const activeSession = sessData.sessions?.find(s => s.status === 'HANDOFF');
            
            if (activeSession) {
              setStatus(activeSession.is_human_active ? 'HUMAN_ACTIVE' : 'REQUESTED');
            } else {
              setStatus('AI_ONLY');
            }
          }
        } catch (err) {}
      };
      fetchStatus();
    }
  }, [ticketId]);

  const handleAction = async (action) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/support/tickets/${ticketId}/handoff`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          agentId
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update handoff state.');
      }

      if (action === 'accept') {
        setStatus('HUMAN_ACTIVE');
        if (onStatusChange) onStatusChange('HUMAN_ACTIVE');
      } else if (action === 'release') {
        setStatus('AI_ONLY');
        if (onStatusChange) onStatusChange('AI_ONLY');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusLabels = {
    AI_ONLY: { label: 'AI Managed', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
    REQUESTED: { label: 'Takeover Requested', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    HUMAN_ACTIVE: { label: 'Agent Active', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
  };

  const curr = statusLabels[status] || statusLabels.AI_ONLY;

  return (
    <div 
      className="handoff-panel"
      style={{
        background: 'var(--bg-secondary, #1e293b)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
        borderRadius: '12px',
        padding: '16px',
        color: 'var(--text)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>🎧 Agent Handoff Panel</h4>
        <span 
          style={{
            fontSize: '11px',
            fontWeight: 600,
            background: curr.bg,
            color: curr.color,
            padding: '4px 10px',
            borderRadius: '12px'
          }}
        >
          {curr.label}
        </span>
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {status === 'REQUESTED' && (
          <button
            onClick={() => handleAction('accept')}
            disabled={loading}
            style={{
              background: '#10b981',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Processing...' : '✔ Accept Takeover Request'}
          </button>
        )}

        {status === 'HUMAN_ACTIVE' && (
          <button
            onClick={() => handleAction('release')}
            disabled={loading}
            style={{
              background: '#ef4444',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Processing...' : '❌ Release to AI Assistant'}
          </button>
        )}

        {status === 'AI_ONLY' && (
          <button
            onClick={() => handleAction('accept')}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '10px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Processing...' : 'Force Connect to Human'}
          </button>
        )}
      </div>
    </div>
  );
}
