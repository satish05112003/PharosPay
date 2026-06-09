import React, { useState, useEffect } from 'react';
import './support.css';

const STEPS = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Review' },
  { id: 3, label: 'Submit' },
];

function StepProgress({ currentStep }) {
  return (
    <div className="escalation-steps">
      {STEPS.map((step, idx) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        return (
          <React.Fragment key={step.id}>
            <div className="escalation-step">
              <div className={`step-circle ${done ? 'done' : active ? 'active' : ''}`}>
                {done ? '✓' : step.id}
              </div>
              <span className={`step-label ${done ? 'done' : active ? 'active' : ''}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`step-line ${done ? 'done' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FieldGroup({ label, required, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      <label className="esc-field-label">
        {label}
        {required && <span className="esc-required">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function EscalationModal({
  isOpen, onClose, onSubmit, ticketId = null, userWallet = '',
}) {
  const [step, setStep]               = useState(1);
  const [submitted, setSubmitted]     = useState(false);
  const [submittedTicketNo, setSubmittedTicketNo] = useState('');

  // Form fields
  const [email, setEmail]             = useState('');
  const [telegram, setTelegram]       = useState('');
  const [discord, setDiscord]         = useState('');
  const [walletAddress, setWalletAddress] = useState(userWallet);
  const [transactionHash, setTransactionHash] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency]         = useState('medium');
  const [error, setError]             = useState(null);
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (userWallet) setWalletAddress(userWallet);
  }, [userWallet]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSubmitted(false);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Validation ──────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      setError('Please enter a valid wallet address (0x + 40 hex characters).');
      return false;
    }
    if (transactionHash && !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
      setError('Transaction hash must be 0x followed by 64 hex characters.');
      return false;
    }
    if (!description || description.trim().length < 20) {
      setError('Please describe the issue in at least 20 characters.');
      return false;
    }
    if (description.trim().length > 2000) {
      setError('Description must be under 2000 characters.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setError(null);
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onSubmit({
        email,
        telegram,
        discord,
        walletAddress,
        transactionHash,
        description,
        urgency,
        ticketId,
      });
      if (ok) {
        setSubmitted(true);
        // Generate a readable ticket number for display
        const num = `ESC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        setSubmittedTicketNo(num);
        setStep(3);
      } else {
        setError('Escalation could not be submitted. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const urgencyLabels = {
    low: '🟢 Low — General question, not time-sensitive',
    medium: '🟡 Medium — Issue affecting payments within 24h',
    high: '🔴 High — Active payment failure or funds at risk',
    critical: '🚨 Critical — Major funds loss or security concern',
  };

  return (
    <div className="escalation-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="escalation-modal">

        {/* Header */}
        <div className="escalation-header">
          <div className="escalation-header-info">
            <h3>Escalate to Human Support</h3>
            <p>Our team responds within 2–4 hours for high priority issues.</p>
          </div>
          <button className="escalation-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Step progress bar */}
        <StepProgress currentStep={step} />

        {/* ── STEP 1: Details ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="escalation-body">
            {error && <div className="esc-error">⚠ {error}</div>}

            <div className="esc-grid-2">
              <FieldGroup label="Email Address" required>
                <input
                  type="email"
                  className="esc-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                />
              </FieldGroup>
              <FieldGroup label="Wallet Address" required>
                <input
                  type="text"
                  className="esc-input"
                  value={walletAddress}
                  onChange={e => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                />
              </FieldGroup>
            </div>

            <div className="esc-grid-2">
              <FieldGroup label="Telegram Handle">
                <input
                  type="text"
                  className="esc-input"
                  value={telegram}
                  onChange={e => setTelegram(e.target.value)}
                  placeholder="@username"
                />
              </FieldGroup>
              <FieldGroup label="Discord Username">
                <input
                  type="text"
                  className="esc-input"
                  value={discord}
                  onChange={e => setDiscord(e.target.value)}
                  placeholder="username#0000"
                />
              </FieldGroup>
            </div>

            <FieldGroup label="Transaction Hash (Optional)" style={{ marginBottom: '14px' }}>
              <input
                type="text"
                className="esc-input"
                value={transactionHash}
                onChange={e => setTransactionHash(e.target.value)}
                placeholder="0x... (leave blank if not applicable)"
              />
            </FieldGroup>

            <FieldGroup label="Urgency Level" style={{ marginBottom: '14px' }}>
              <select
                className="esc-input esc-select"
                value={urgency}
                onChange={e => setUrgency(e.target.value)}
              >
                {Object.entries(urgencyLabels).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Describe Your Issue" required style={{ marginBottom: '0' }}>
              <textarea
                className="esc-input esc-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Provide details: what happened, when, and what you expected. Include error messages or payment IDs."
                rows={4}
              />
              <div style={{ fontSize: '11px', color: description.length > 1800 ? '#ef4444' : 'var(--text-tertiary)', textAlign: 'right', marginTop: '4px' }}>
                {description.length} / 2000
              </div>
            </FieldGroup>

            <div className="escalation-footer">
              <button className="esc-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="esc-btn-primary" onClick={handleNext}>
                Review Details →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Review ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="escalation-body">
            {error && <div className="esc-error">⚠ {error}</div>}

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Please review your escalation details before submitting. Our support team will contact you at the email provided.
            </p>

            <div className="review-card">
              <div className="review-row">
                <span className="review-row-label">Email</span>
                <span className="review-row-value">{email}</span>
              </div>
              <div className="review-row">
                <span className="review-row-label">Wallet</span>
                <span className="review-row-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                </span>
              </div>
              {telegram && (
                <div className="review-row">
                  <span className="review-row-label">Telegram</span>
                  <span className="review-row-value">{telegram}</span>
                </div>
              )}
              {discord && (
                <div className="review-row">
                  <span className="review-row-label">Discord</span>
                  <span className="review-row-value">{discord}</span>
                </div>
              )}
              {transactionHash && (
                <div className="review-row">
                  <span className="review-row-label">Tx Hash</span>
                  <span className="review-row-value" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                  </span>
                </div>
              )}
              <div className="review-row">
                <span className="review-row-label">Urgency</span>
                <span className="review-row-value" style={{ textTransform: 'capitalize' }}>{urgency}</span>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px',
            }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Issue Description</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                {description}
              </p>
            </div>

            <div style={{
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '0',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
            }}>
              ⏱ <strong style={{ color: 'var(--text)' }}>Expected response time:</strong>{' '}
              {urgency === 'critical' ? 'Within 30 minutes' :
               urgency === 'high'     ? 'Within 2 hours'    :
               urgency === 'medium'   ? 'Within 4 hours'    :
                                        'Within 24 hours'}
              {' '}— Ticket #{ticketId || 'New'}
            </div>

            <div className="escalation-footer">
              <button className="esc-btn-secondary" onClick={handleBack}>← Back</button>
              <button
                className="esc-btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Submitting…
                  </>
                ) : '✓ Confirm & Submit'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Success ─────────────────────────────────────────── */}
        {step === 3 && submitted && (
          <div className="esc-success">
            <div className="esc-success-check">✓</div>
            <h3 className="esc-success-title">Escalation Submitted!</h3>
            <div className="esc-success-ticket">{submittedTicketNo || `ESC-${ticketId || 'PENDING'}`}</div>
            <p className="esc-success-eta">
              We'll contact you at <strong style={{ color: 'var(--text)' }}>{email}</strong> with an update.
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6', textAlign: 'center', maxWidth: '320px' }}>
              Our human support agents are available 24/7 for critical issues. You can continue chatting with the AI assistant while you wait.
            </p>
            <button
              className="esc-btn-primary"
              onClick={onClose}
              style={{ marginTop: '4px' }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
