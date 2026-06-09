import React from 'react';
import './support.css';

function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

function getSessionTitle(sess) {
  // Try to derive a human title from lastMessage or sessionId
  if (sess.title) return sess.title;
  if (sess.lastMessage) {
    const trimmed = sess.lastMessage.trim();
    if (trimmed && trimmed !== '[New Support Session Initiated]') {
      return trimmed.length > 30 ? trimmed.slice(0, 30) + '…' : trimmed;
    }
  }
  return 'Support Session';
}

function getSessionPreview(sess) {
  if (sess.lastMessage) {
    const t = sess.lastMessage.trim();
    if (t && t !== '[New Support Session Initiated]') {
      return t.length > 45 ? t.slice(0, 45) + '…' : t;
    }
  }
  if (sess.lastAiMessage) {
    const t = sess.lastAiMessage.trim();
    return t.length > 45 ? t.slice(0, 45) + '…' : t;
  }
  if (sess.messageCount > 0) {
    return 'Loading preview...';
  }
  return 'No messages yet';
}

export default function SessionSidebar({ sessions, activeSessionId, onSelectSession, onNewSession, loading }) {
  return (
    <div className="support-session-sidebar support-scroll">
      {/* Header: New Chat button */}
      <div style={{ padding: '14px 14px 10px' }}>
        <button className="sidebar-new-chat-btn" onClick={onNewSession}>
          <span style={{ fontSize: '16px' }}>✦</span> New Conversation
        </button>
      </div>

      {/* Session List */}
      <div className="support-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 14px' }}>
        <p className="sidebar-section-label" style={{ marginBottom: '10px', marginTop: '4px' }}>
          Conversations
        </p>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: '68px', borderRadius: '10px' }} />
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">💬</div>
            <div className="sidebar-empty-title">No conversations yet</div>
            <div className="sidebar-empty-desc">
              Start a new chat to get support with payments, receipts, settlements, and the Pharos ecosystem.
            </div>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {sessions.map((sess) => {
              const isActive = sess.sessionId === activeSessionId;
              const title = getSessionTitle(sess);
              const preview = getSessionPreview(sess);
              const ago = timeAgo(sess.lastMessageAt || sess.createdAt);
              const count = sess.messageCount || 0;
              const isHandoff = sess.status === 'HANDOFF';

              return (
                <button
                  key={sess.sessionId}
                  onClick={() => onSelectSession(sess.sessionId)}
                  className={`session-item ${isActive ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span className="session-item-title">{title}</span>
                    {isHandoff && (
                      <span
                        className="session-item-badge"
                        style={{
                          background: 'rgba(34, 197, 94, 0.12)',
                          color: '#22c55e',
                          fontSize: '8px',
                          flexShrink: 0,
                        }}
                      >
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="session-item-preview">{preview}</div>
                  <div className="session-item-meta">
                    <span>{ago}</span>
                    {count > 0 && (
                      <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-tertiary)' }}>
                        {count} msg{count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
