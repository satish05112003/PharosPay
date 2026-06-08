import React, { useState } from 'react';

const AGENTS = [
  { id: 'agent_alpha', name: 'Support Agent Alpha' },
  { id: 'agent_omega', name: 'Support Lead Omega' },
  { id: 'agent_delta', name: 'Finance Specialist Delta' },
  { id: 'agent_beta', name: 'Compliance Officer Beta' }
];

export default function TicketAssignModal({ isOpen, onClose, ticketId, onAssigned, currentAgentId }) {
  const [selectedAgent, setSelectedAgent] = useState(currentAgentId || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent || null })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign ticket.');
      }

      onAssigned(result.ticket);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div 
        style={{
          background: 'var(--bg-secondary, #1e293b)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '400px',
          padding: '20px',
          color: 'var(--text)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Assign Support Ticket</h4>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer' }}>&times;</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
              Select Administrative Officer
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary, #0f172a)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text)',
                fontSize: '14px',
                outline: 'none'
              }}
            >
              <option value="">-- Unassigned --</option>
              {AGENTS.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: '6px',
                padding: '8px 14px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              style={{
                background: 'var(--primary, #6366f1)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {submitting ? 'Updating...' : 'Save Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
