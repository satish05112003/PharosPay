import React from 'react';
import './support.css';

export default function TypingIndicator() {
  return (
    <div className="msg-row ai" style={{ marginBottom: '4px' }}>
      <div className="typing-bubble">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}
