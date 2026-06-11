import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../config';

// Base URL resolver for Socket.IO (remove /api suffix from API_BASE if present)
const getSocketUrl = () => {
  return API_BASE.replace('/api', '');
};

export default function useAIChat(wallet, sessionId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState(null);
  
  const socketRef = useRef(null);

  // Load past messages for the current session
  const loadHistory = useCallback(async (sid) => {
    if (!sid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/support/session/${sid}/messages`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load session history:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!wallet || !sessionId) return;

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to server.');
      // Join rooms
      socket.emit('join_session', sessionId);
      socket.emit('join_wallet', wallet);
    });

    // Listen for AI responses
    socket.on('support:response', (payload) => {
      if (payload.sessionId === sessionId) {
        setTyping(false);
        setMessages(prev => {
          // Prevent duplicates if already inserted by fallback or socket
          if (prev.some(m => m.id === payload.messageId)) return prev;
          return [
            ...prev,
            {
              id: payload.messageId,
              senderType: 'ai',
              senderName: 'Pharos',
              content: payload.answer,
              createdAt: new Date().toISOString(),
              metadata: {
                severity: payload.severity,
                category: payload.category,
                confidence: payload.confidence,
                needsEscalation: payload.needsEscalation,
                escalationReason: payload.escalationReason,
                suggestedActions: payload.suggestedActions,
                relatedPayments: payload.relatedPayments,
                modelUsed: payload.modelUsed,
                processingMs: payload.processingMs,
                ticketId: payload.ticketId
              }
            }
          ];
        });
      }
    });

    // Listen for real-time agent/admin replies
    socket.on('support:message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [
          ...prev,
          {
            id: msg.id,
            senderType: msg.senderType,
            senderName: msg.senderName,
            content: msg.message,
            createdAt: msg.createdAt
          }
        ];
      });
    });

    socket.on('support:error', (payload) => {
      if (payload.sessionId === sessionId) {
        setTyping(false);
        setError(payload.error || 'AI request failed.');
        const isTimeout = payload.error === 'AI provider timeout' || payload.error?.includes('API key') || payload.error?.includes('unavailable');
        setMessages(prev => [
          ...prev,
          {
            id: 'err_' + Date.now(),
            senderType: 'ai',
            senderName: 'Pharos System',
            content: isTimeout ? 'AI assistant is currently unavailable. Please try again.' : (payload.answer || 'AI assistant is currently unavailable. Please try again.'),
            createdAt: new Date().toISOString()
          }
        ]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [wallet, sessionId]);

  // Load history when session changes
  useEffect(() => {
    if (sessionId) {
      loadHistory(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId, loadHistory]);

  // Send message to the backend
  const sendMessage = useCallback(async (text) => {
    if (!wallet || !sessionId || !text.trim()) return;

    setError(null);
    setTyping(true);

    // Append user message locally instantly
    const tempUserMsgId = 'temp_' + Date.now();
    setMessages(prev => [
      ...prev,
      {
        id: tempUserMsgId,
        senderType: 'user',
        senderName: wallet.slice(0, 6) + '...' + wallet.slice(-4),
        content: text,
        createdAt: new Date().toISOString()
      }
    ]);

    try {
      const response = await fetch(`${API_BASE}/support/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          message: text,
          sessionId
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit support message.');
      }

      if (result.status === 'completed') {
        const payload = result.data;
        setTyping(false);
        setMessages(prev => {
          if (prev.some(m => m.id === payload.messageId)) return prev;
          return [
            ...prev,
            {
              id: payload.messageId,
              senderType: 'ai',
              senderName: 'Pharos',
              content: payload.answer,
              createdAt: new Date().toISOString(),
              metadata: {
                severity: payload.severity,
                category: payload.category,
                confidence: payload.confidence,
                needsEscalation: payload.needsEscalation,
                escalationReason: payload.escalationReason,
                suggestedActions: payload.suggestedActions,
                relatedPayments: payload.relatedPayments,
                modelUsed: payload.modelUsed,
                processingMs: payload.processingMs,
                ticketId: payload.ticketId
              }
            }
          ];
        });
        return;
      }

      const messageId = result.messageId;
      
      // Fallback Poll Check
      setTimeout(async () => {
        try {
          const pollRes = await fetch(`${API_BASE}/support/chat/${messageId}/result`);
          const pollData = await pollRes.json();
          
          if (pollData.success && (pollData.status === 'completed' || pollData.status === 'timeout_fallback')) {
            const payload = pollData.data;
            setTyping(false);
            setMessages(prev => {
              if (prev.some(m => m.id === payload.messageId || m.id === messageId)) return prev;
              return [
                ...prev,
                {
                  id: payload.messageId || messageId,
                  senderType: 'ai',
                  senderName: 'Pharos',
                  content: payload.answer,
                  createdAt: new Date().toISOString(),
                  metadata: {
                    severity: payload.severity,
                    category: payload.category,
                    confidence: payload.confidence,
                    needsEscalation: payload.needsEscalation,
                    escalationReason: payload.escalationReason,
                    suggestedActions: payload.suggestedActions,
                    relatedPayments: payload.relatedPayments,
                    modelUsed: payload.modelUsed,
                    processingMs: payload.processingMs,
                    ticketId: payload.ticketId
                  }
                }
              ];
            });
          }
        } catch (err) {
          console.warn('Long polling fallback attempt failed:', err.message);
        }
      }, 5000); // 5 seconds wait

    } catch (err) {
      setTyping(false);
      setError(err.message);
      setMessages(prev => [
        ...prev,
        {
          id: 'err_submit_' + Date.now(),
          senderType: 'ai',
          senderName: 'Pharos',
          content: `Support service unavailable. Please try again in a moment.\n\nTechnical Diagnostics: ${err.message}`,
          createdAt: new Date().toISOString()
        }
      ]);
    }
  }, [wallet, sessionId]);

  return {
    messages,
    loading,
    typing,
    error,
    sendMessage,
    setMessages
  };
}
