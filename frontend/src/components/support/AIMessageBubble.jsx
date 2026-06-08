import React from 'react';
import SeverityIndicator from './SeverityIndicator';

export default function AIMessageBubble({ message, showDebug, onSelectOption }) {
  const { content, metadata, createdAt } = message;

  // Simple parser to extract bullet options
  const parseContent = (text) => {
    if (!text) return { parsedElements: [], options: [] };
    const lines = text.split('\n');
    const parsedElements = [];
    const options = [];
    let textAccumulator = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^\s*[\*\-•]\s+(.+)$/);
      if (match) {
        if (textAccumulator.length > 0) {
          parsedElements.push(
            <div key={`txt-${i}`} style={{ marginBottom: '8px', whiteSpace: 'pre-line' }}>
              {textAccumulator.join('\n')}
            </div>
          );
          textAccumulator = [];
        }
        options.push(match[1].trim());
      } else {
        textAccumulator.push(line);
      }
    }

    if (textAccumulator.length > 0) {
      parsedElements.push(
        <div key="txt-final" style={{ whiteSpace: 'pre-line' }}>
          {textAccumulator.join('\n')}
        </div>
      );
    }

    return { parsedElements, options };
  };

  const { parsedElements, options } = parseContent(content);

  return (
    <div className="ai-message-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', maxWidth: '85%' }}>
      <div 
        className="ai-message-bubble" 
        style={{
          background: 'var(--bg-secondary, rgba(255, 255, 255, 0.06))',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px 16px 16px 4px',
          padding: '12px 16px',
          color: 'var(--text, #ffffff)',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
      >
        {parsedElements}

        {options.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {options.map((opt, index) => (
              <button
                key={index}
                onClick={() => onSelectOption && onSelectOption(opt)}
                style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  color: 'var(--primary, #6366f1)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      <div 
        className="ai-message-meta" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          fontSize: '11px', 
          color: 'var(--text-secondary, #94a3b8)',
          paddingLeft: '4px' 
        }}
      >
        {showDebug && metadata && (
          <>
            {metadata.severity && <SeverityIndicator severity={metadata.severity} />}
            {metadata.modelUsed && (
              <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                {metadata.modelUsed}
              </span>
            )}
            {metadata.processingMs && (
              <span>{metadata.processingMs}ms</span>
            )}
          </>
        )}
        <span>{new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}
