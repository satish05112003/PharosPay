import { useState, useCallback } from 'react';
import { API_BASE } from '../config';

export default function useEscalation(wallet, sessionId) {
  const [escalating, setEscalating] = useState(false);
  const [escalationResult, setEscalationResult] = useState(null);
  const [error, setError] = useState(null);

  const escalate = useCallback(async (formData) => {
    if (!wallet) return null;

    setEscalating(true);
    setError(null);
    setEscalationResult(null);

    try {
      const response = await fetch(`${API_BASE}/support/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          // walletAddress mirrors wallet — backend also accepts walletAddress separately
          walletAddress: formData.walletAddress || wallet,
          sessionId: sessionId || null,
          email: formData.email,
          telegram: formData.telegram || null,
          discord: formData.discord || null,
          twitter: formData.twitter || null,
          // transactionHash from EscalationModal form
          transactionHash: formData.transactionHash || null,
          description: formData.description,
          severity: formData.severity || formData.urgency?.toUpperCase() || 'MEDIUM',
          confidence: formData.confidence || 0.85,
          ticketId: formData.ticketId || null,
          urgency: formData.urgency || null
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Escalation failed (HTTP ${response.status}).`);
      }

      setEscalationResult(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setEscalating(false);
    }
  }, [wallet, sessionId]);

  return {
    escalating,
    escalationResult,
    error,
    escalate
  };
}
