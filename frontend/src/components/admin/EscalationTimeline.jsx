import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
import { parseIsoDate } from '../../utils/contextUtils';

export default function EscalationTimeline({ ticketId }) {
  const [data, setData] = useState({ events: [], contacts: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/admin/support/tickets/${ticketId}/escalations`);
        const result = await res.json();
        if (result.success) {
          setData(result);
        }
      } catch (err) {
        console.warn('Failed to fetch ticket escalation timeline:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [ticketId]);

  if (loading) return <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading timeline...</div>;

  const { events, contacts } = data;
  const primaryContact = contacts[0] || {};

  return (
    <div 
      className="escalation-timeline-container"
      style={{
        background: 'var(--bg-secondary, #1e293b)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
        borderRadius: '12px',
        padding: '16px',
        color: 'var(--text)'
      }}
    >
      <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700 }}>📋 Escalation History & Contact info</h4>

      {/* Contact Details */}
      {contacts.length > 0 && (
        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            fontSize: '12px'
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Escalation Contact Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><strong>Email:</strong> {primaryContact.email || 'N/A'}</div>
            <div><strong>Telegram:</strong> {primaryContact.telegram || 'N/A'}</div>
            <div><strong>Discord:</strong> {primaryContact.discord || 'N/A'}</div>
            <div><strong>Twitter/X:</strong> {primaryContact.twitter || 'N/A'}</div>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px 0' }}>
          No escalation events recorded.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '24px' }}>
          {/* Vertical line connector */}
          <div 
            style={{
              position: 'absolute',
              top: '8px',
              bottom: '8px',
              left: '7px',
              width: '2px',
              background: 'rgba(255, 255, 255, 0.1)'
            }}
          />

          {events.map((evt, idx) => (
            <div 
              key={evt.id || idx}
              style={{
                position: 'relative',
                marginBottom: idx === events.length - 1 ? 0 : '16px',
                fontSize: '12px'
              }}
            >
              {/* Pulsing indicator node */}
              <div 
                style={{
                  position: 'absolute',
                  left: '-23px',
                  top: '4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: evt.triggerSource === 'AI_AUTO' ? '#dc2626' : '#6366f1',
                  border: '2px solid var(--bg-secondary, #1e293b)'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ color: evt.triggerSource === 'AI_AUTO' ? '#ef4444' : 'var(--text)' }}>
                  {evt.triggerSource === 'AI_AUTO' ? 'AI Automated Escalation' : 'User Requested Escalation'}
                </strong>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  {parseIsoDate(evt.occurredAt)}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                Priority forced to <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{evt.severity}</span>
                {evt.confidence && ` (${(Number(evt.confidence) * 100).toFixed(0)}% confidence)`}
              </div>
              {evt.emailSentTo && (
                <div style={{ fontSize: '10px', color: '#10b981', marginTop: '2px' }}>
                  ✓ Notification email sent to {evt.emailSentTo}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
