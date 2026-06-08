import React from 'react';
import { parseIsoDate } from '../../utils/contextUtils';

export default function SessionSidebar({ sessions, activeSessionId, onSelectSession, onNewSession, loading }) {
  return (
    <div 
      className="session-sidebar" 
      style={{
        width: '260px',
        borderRight: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(255, 255, 255, 0.01)'
      }}
    >
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.1))' }}>
        <button
          onClick={onNewSession}
          style={{
            width: '100%',
            background: 'var(--primary, #6366f1)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span>💬</span> New Chat Session
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Recent Sessions
        </h4>

        {loading && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '12px' }}>Loading...</div>}

        {!loading && sessions.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '12px', textAlign: 'center' }}>
            No past chat sessions
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sessions.map((sess) => {
            const isActive = sess.sessionId === activeSessionId;
            return (
              <button
                key={sess.sessionId}
                onClick={() => onSelectSession(sess.sessionId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  outline: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: '12px', color: isActive ? 'var(--primary, #6366f1)' : 'var(--text, #ffffff)', fontWeight: isActive ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                    {sess.sessionId.substring(0, 15)}...
                  </span>
                  <span 
                    style={{
                      fontSize: '9px',
                      background: sess.status === 'HANDOFF' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: sess.status === 'HANDOFF' ? '#10b981' : 'var(--text-secondary, #94a3b8)',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}
                  >
                    {sess.status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary, #94a3b8)' }}>
                  <span>{sess.messageCount} msgs</span>
                  <span>{parseIsoDate(sess.lastMessageAt).split(',')[0]}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
