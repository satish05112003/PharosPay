import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../config';

const getSocketUrl = () => {
  return API_BASE.replace('/api', '');
};

export default function useHandoff(sessionId, initialHandoffState = 'AI_ONLY') {
  const [handoffStatus, setHandoffStatus] = useState(initialHandoffState);
  const [bannerMessage, setBannerMessage] = useState('');
  const [agentId, setAgentId] = useState(null);
  
  const socketRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_session', sessionId);
    });

    // Listen to handoff status broadcasts
    socket.on('support:handoff_status', (data) => {
      console.log('[Socket.IO] Handoff Status Update:', data);
      
      if (data.status === 'ACTIVE') {
        setHandoffStatus('HUMAN_ACTIVE');
        setAgentId(data.agentId);
        setBannerMessage(data.message || 'You are now speaking with a PharosPay agent');
      } else if (data.status === 'RELEASED') {
        setHandoffStatus('AI_ONLY');
        setAgentId(null);
        setBannerMessage(data.message || 'Agent left. Returned to AI Support.');
      } else if (data.status === 'TIMED_OUT') {
        setHandoffStatus('AI_ONLY');
        setAgentId(null);
        setBannerMessage(data.message || 'Handoff timed out. Returning to AI.');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  const requestHandoff = useCallback(async (wallet, ticketId, reason) => {
    setHandoffStatus('HANDOFF_REQUESTED');
    setBannerMessage('Connecting you with a human agent. Please hold for a moment...');

    try {
      const response = await fetch(`${API_BASE}/support/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          sessionId,
          message: `[Handoff Requested]: ${reason || 'User requested human agent.'}`
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to request handoff.');
      }

      // Check if ticket exists or trigger handoff directly in the backend
      // (This will call HumanHandoffService.requestHandoff)
      return result;
    } catch (err) {
      console.error('[useHandoff] Handoff request error:', err.message);
      setHandoffStatus('AI_ONLY');
      setBannerMessage('Failed to request handoff. Please try again.');
      return null;
    }
  }, [sessionId]);

  return {
    handoffStatus,
    bannerMessage,
    agentId,
    requestHandoff,
    setHandoffStatus,
    setBannerMessage
  };
}
