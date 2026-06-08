import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
import SeverityIndicator from '../support/SeverityIndicator';

export default function AIAnalysisCard({ ticketId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/support/tickets/${ticketId}`);
      const data = await res.json();
      if (data.success && data.ticket) {
        // Fetch matching analysis from analyses endpoints or search
        const anaRes = await fetch(`${API_BASE}/admin/support/analytics/overview`);
        // Wait, instead of calling general overview, we can fetch tickets detail or run a direct lookup
        // Let's call /api/admin/support/tickets/:ticketId/reanalyze or query directly!
        // To be extremely clean, we can write a GET /api/admin/support/tickets/:ticketId/analysis route,
        // or since we already have an overview, let's query it. Let's add a GET endpoint for this in adminV2.js!
        // Wait, did we create a route in adminV2.js to get analysis? We created POST reanalyze, but not GET.
        // Let's add a GET /tickets/:ticketId/analysis in adminV2.js to return the existing ai_analyses record!
        // Yes, that makes it extremely clean and robust. Let's do that!
        const getAna = await fetch(`${API_BASE}/admin/support/tickets/${ticketId}/analysis`);
        const anaData = await getAna.json();
        if (anaData.success) {
          setAnalysis(anaData.analysis);
        }
      }
    } catch (err) {
      console.warn('Failed to load ticket analysis details:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchAnalysis();
    }
  }, [ticketId]);

  const handleReanalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/support/tickets/${ticketId}/reanalyze`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.analysis);
      } else {
        throw new Error(data.error || 'Failed to re-run analysis');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !analysis) {
    return <div style={{ color: 'var(--text-secondary)', padding: '16px' }}>Analyzing ticket content...</div>;
  }

  if (error && !analysis) {
    return <div style={{ color: '#ef4444', padding: '16px' }}>Error: {error}</div>;
  }

  if (!analysis) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>No AI Analysis details found for this ticket.</p>
        <button 
          onClick={handleReanalyze}
          style={{ background: 'var(--primary, #6366f1)', border: 'none', borderRadius: '6px', padding: '6px 12px', color: '#ffffff', fontSize: '12px', cursor: 'pointer' }}
        >
          Generate Analysis
        </button>
      </div>
    );
  }

  return (
    <div 
      className="ai-analysis-card" 
      style={{
        background: 'var(--bg-secondary, #1e293b)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
        borderRadius: '12px',
        padding: '16px',
        color: 'var(--text)',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>🔍 Pharos AI Diagnostic Report</h4>
        <button
          onClick={handleReanalyze}
          disabled={loading}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            padding: '4px 10px',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Analyzing...' : 'Rerun Analysis'}
        </button>
      </div>

      {analysis.injection_detected && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '8px 12px', marginBottom: '16px', color: '#ef4444', fontSize: '12px', fontWeight: 600 }}>
          ⚠️ PROMPT INJECTION BLOCKED: Malicious script or instruction override detected in user message.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px', fontSize: '12px' }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Classification Summary</div>
          <SeverityIndicator severity={analysis.severity} confidence={Number(analysis.confidence)} />
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Identified Category</div>
          <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{analysis.category.replace('_', ' ')}</span>
        </div>
      </div>

      <div style={{ fontSize: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Hypothesized Root Cause:</div>
        <p style={{ margin: 0, lineHeight: '1.4', color: 'var(--text)' }}>{analysis.root_cause || 'User requested human escalation path.'}</p>
      </div>

      <div style={{ fontSize: '12px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Estimated Resolution Time:</div>
        <span>{analysis.estimated_resolution || '1-2 hours'}</span>
      </div>

      {analysis.suggested_actions && analysis.suggested_actions.length > 0 && (
        <div style={{ fontSize: '12px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Suggested Admin Actions:</div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {analysis.suggested_actions.map((act, i) => (
              <li key={i}>{act}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
        <span>Model: {analysis.model_used}</span>
        {analysis.processing_ms && <span>Latency: {analysis.processing_ms}ms</span>}
      </div>
    </div>
  );
}
