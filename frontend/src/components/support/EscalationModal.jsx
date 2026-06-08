import React, { useState, useEffect } from 'react';

export default function EscalationModal({ isOpen, onClose, onSubmit, severity = 'MEDIUM', confidence = 0.85, ticketId = null, userWallet = '' }) {
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [discord, setDiscord] = useState('');
  const [twitter, setTwitter] = useState('');
  const [walletAddress, setWalletAddress] = useState(userWallet);
  const [transactionHash, setTransactionHash] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userWallet) {
      setWalletAddress(userWallet);
    }
  }, [userWallet]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!email || !emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      setError('Please enter a valid wallet address (0x followed by 40 hex characters).');
      return;
    }

    if (transactionHash && !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
      setError('Please enter a valid transaction hash (0x followed by 64 hex characters).');
      return;
    }

    if (!description || description.trim().length < 20 || description.trim().length > 2000) {
      setError('Please provide a description between 20 and 2000 characters.');
      return;
    }

    if (telegram && telegram.includes(' ')) {
      setError('Telegram handle must not contain spaces.');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onSubmit({
        email,
        telegram,
        discord,
        twitter,
        walletAddress,
        transactionHash,
        description,
        severity,
        confidence,
        ticketId
      });
      if (ok) {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to submit escalation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div 
        style={{
          background: 'var(--bg-secondary, #1e293b)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '500px',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '18px', fontWeight: 700 }}>Escalate Support Ticket</h3>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', color: '#ef4444', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Email Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary, #0f172a)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Wallet Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text" 
                required
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary, #0f172a)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Telegram Handle
              </label>
              <input 
                type="text" 
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary, #0f172a)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Discord Username
              </label>
              <input 
                type="text" 
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="username#0000"
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary, #0f172a)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Twitter/X Handle
              </label>
              <input 
                type="text" 
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@username"
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary, #0f172a)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Transaction Hash
              </label>
              <input 
                type="text" 
                value={transactionHash}
                onChange={(e) => setTransactionHash(e.target.value)}
                placeholder="0x..."
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary, #0f172a)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Detailed Description <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea 
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe your issue in detail (minimum 20 characters)..."
              style={{
                width: '100%',
                background: 'var(--bg-tertiary, #0f172a)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                borderRadius: '8px',
                padding: '10px 12px',
                color: 'var(--text)',
                outline: 'none',
                resize: 'vertical',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button 
              type="button" 
              onClick={onClose} 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                borderRadius: '8px',
                padding: '10px 16px',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              style={{
                background: 'var(--primary, #6366f1)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Escalation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
