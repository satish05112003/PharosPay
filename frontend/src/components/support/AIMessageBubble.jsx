import React from 'react';
import SeverityIndicator from './SeverityIndicator';
import './support.css';

export function formatMessageText(text) {
  if (!text) return '';
  const regex = /(0x[0-9a-fA-F]{64}|0x[0-9a-fA-F]{40}|SIM-UPI-\d+|UPI\d+|UTR\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|PHAROS-[A-Z0-9-]+|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(regex);
  if (parts.length === 1) {
    return text;
  }
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="chat-code-block">{part.slice(1, -1)}</code>;
    }
    if (/^(0x[0-9a-fA-F]{64}|0x[0-9a-fA-F]{40}|SIM-UPI-\d+|UPI\d+|UTR\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|PHAROS-[A-Z0-9-]+)$/.test(part)) {
      return (
        <code key={index} className="chat-code-block message-content">
          {part}
        </code>
      );
    }
    return part;
  });
}

export function renderMarkdownAndHashes(text) {
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((para, paraIdx) => {
    const lines = para.split('\n');
    const renderedElements = [];
    let currentList = null;

    const flushList = (key) => {
      if (currentList) {
        const ListTag = currentList.type;
        renderedElements.push(
          <ListTag key={key} className="chat-list">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="chat-list-item">
                {formatMessageText(item)}
              </li>
            ))}
          </ListTag>
        );
        currentList = null;
      }
    };

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      const bulletMatch = line.match(/^\s*[\*\-•]\s+(.+)$/);
      const numberedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);

      if (bulletMatch) {
        if (currentList && currentList.type !== 'ul') {
          flushList(`list-${lineIdx}`);
        }
        if (!currentList) {
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(bulletMatch[1]);
      } else if (numberedMatch) {
        if (currentList && currentList.type !== 'ol') {
          flushList(`list-${lineIdx}`);
        }
        if (!currentList) {
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(numberedMatch[2]);
      } else {
        flushList(`list-${lineIdx}`);
        if (trimmed) {
          renderedElements.push(
            <div key={`line-${lineIdx}`} className="chat-line">
              {formatMessageText(line)}
            </div>
          );
        }
      }
    });

    flushList(`list-final`);

    return (
      <div key={paraIdx} className="chat-paragraph">
        {renderedElements}
      </div>
    );
  });
}

export default function AIMessageBubble({ message, showDebug, onSelectOption, style }) {
  const { content, metadata, createdAt } = message;

  // Markdown-lite parser: trailing short bullet lines become interactive option buttons
  const parseContent = (text) => {
    if (!text) return { paragraphs: [], options: [] };
    const lines = text.split('\n');
    const paragraphs = [];
    const options = [];
    let textBuffer = [];

    let trailingBulletIndex = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const isBullet = /^\s*[\*\-•]\s+(.+)$/.test(line);
      const isEmpty = line.trim() === '';
      if (isBullet) {
        trailingBulletIndex = i;
      } else if (!isEmpty) {
        break;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const bulletMatch = line.match(/^\s*[\*\-•]\s+(.+)$/);
      if (bulletMatch && i >= trailingBulletIndex && bulletMatch[1].length < 60 && !bulletMatch[1].endsWith('.')) {
        if (textBuffer.length > 0) {
          paragraphs.push(textBuffer.join('\n'));
          textBuffer = [];
        }
        options.push(bulletMatch[1].trim());
      } else {
        textBuffer.push(line);
      }
    }
    if (textBuffer.length > 0) paragraphs.push(textBuffer.join('\n'));
    return { paragraphs, options };
  };

  const { paragraphs, options } = parseContent(content);
  const time = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="msg-row ai" style={style}>
      <div className="ai-bubble message-content">
        {/* Rendered text paragraphs and lists */}
        {paragraphs.map((para, i) => {
          const trimmed = para.trim();
          if (!trimmed) return null;
          return (
            <div key={i}>
              {renderMarkdownAndHashes(trimmed)}
            </div>
          );
        })}

        {/* Interactive option buttons */}
        {options.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginTop: '12px' }}>
            {options.map((opt, idx) => (
              <button
                key={idx}
                className="ai-option-btn message-content"
                onClick={() => onSelectOption && onSelectOption(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Meta row: time + optional debug badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px' }}>
        {showDebug && metadata && (
          <>
            {metadata.severity && <SeverityIndicator severity={metadata.severity} />}
            {metadata.modelUsed && (
              <span style={{
                fontSize: '9px',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                color: 'var(--text-secondary)',
              }}>
                {metadata.modelUsed}
              </span>
            )}
            {metadata.processingMs && (
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                {metadata.processingMs}ms
              </span>
            )}
          </>
        )}
        <span className="msg-time">{time}</span>
      </div>
    </div>
  );
}
