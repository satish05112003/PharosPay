import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';

export default function useSupportSession(wallet) {
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('pharospay_support_session_id') || '';
  });
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Cache session in local storage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('pharospay_support_session_id', sessionId);
    } else {
      localStorage.removeItem('pharospay_support_session_id');
    }
  }, [sessionId]);

  const loadSessions = useCallback(async () => {
    if (!wallet) return;
    setLoadingSessions(true);
    try {
      const res = await fetch(`${API_BASE}/support/sessions/wallet/${wallet}`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err.message);
    } finally {
      setLoadingSessions(false);
    }
  }, [wallet]);

  const startNewSession = useCallback(() => {
    // Generate simple UUID client-side
    const newId = 'session_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setSessionId(newId);
    return newId;
  }, []);

  const switchSession = useCallback((id) => {
    setSessionId(id);
  }, []);

  const clearSession = useCallback(() => {
    setSessionId('');
    localStorage.removeItem('pharospay_support_session_id');
  }, []);

  // Auto-load sessions when wallet changes
  useEffect(() => {
    loadSessions();
  }, [wallet, loadSessions]);

  return {
    sessionId,
    sessions,
    loadingSessions,
    loadSessions,
    startNewSession,
    switchSession,
    clearSession,
    setSessionId
  };
}
