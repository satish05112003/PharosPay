import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

export default function VerifyReceipt() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | searching | verified | tampered | not_found | wallet_list
  const [result, setResult] = useState(null);
  const [payments, setPayments] = useState([]);
  const [walletShort, setWalletShort] = useState('');
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportDesc, setReportDesc] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const handleSearch = async (e, searchQuery = query) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setStatus('searching');
    setError('');
    setResult(null);
    setPayments([]);
    setReportSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/receipts/verify?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification query failed.');
      }

      if (data.type === 'wallet_list') {
        setWalletShort(searchQuery.trim().slice(0, 6) + '...' + searchQuery.trim().slice(-4));
        setPayments(data.payments || []);
        setStatus('wallet_list');
      } else if (data.verified) {
        setResult(data);
        setStatus('verified');
      } else {
        if (data.reason === 'signature_mismatch' || data.reason === 'verification_error') {
          setStatus('tampered');
        } else {
          setStatus('not_found');
        }
      }
    } catch (err) {
      setError(err.message);
      setStatus('not_found');
    }
  };

  const handleDownloadPDF = () => {
    if (!result || !result.receiptSummary) return;
    const paymentId = result.receiptSummary.payment.paymentId;
    window.open(`${API_BASE}/receipts/${paymentId}/pdf`, '_blank');
  };

  const handleReportReceipt = async (e) => {
    e.preventDefault();
    setReporting(true);
    try {
      const res = await fetch(`${API_BASE}/receipts/verify/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          reporterEmail,
          description: reportDesc
        })
      });
      if (res.ok) {
        setReportSuccess(true);
        setReportDesc('');
      }
    } catch (err) {
      alert('Failed to submit report. Please try again.');
    } finally {
      setReporting(false);
    }
  };

  const handleRowClick = (paymentId) => {
    handleSearch(null, paymentId);
  };

  return (
    <div 
      style={{
        minHeight: '100vh',
        background: 'var(--bg, #0b0f19)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'sans-serif'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-secondary, rgba(255, 255, 255, 0.03))',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src="/assets/branding/logo.png" alt="Pharos" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text, #ffffff)', letterSpacing: '-0.5px' }}>PharosPay</span>
        </div>

        {status === 'idle' && (
          <div style={{ width: '100%' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: 'var(--text, #ffffff)' }}>Verify a PharosPay Receipt</h2>
            <p style={{ textAlign: 'center', margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.4' }}>
              Enter any receipt identifier to verify cryptographic authenticity.
            </p>

            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input 
                type="text" 
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Receipt ID, UTR, Tx Hash, or Wallet Address"
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary, #0f172a)',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: 'var(--text, #ffffff)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />

              <button 
                type="submit"
                style={{
                  width: '100%',
                  background: 'var(--primary, #6366f1)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Verify Receipt
              </button>
            </form>

            <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
              <span style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Try searching:</span>
              <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>Receipt ID:</strong> starts with RCPT-</li>
                <li><strong>UTR / Ref Number:</strong> reference number</li>
                <li><strong>Tx Hash:</strong> 0x + 64 hex characters</li>
                <li><strong>Wallet:</strong> 0x + 40 hex characters</li>
              </ul>
            </div>
          </div>
        )}

        {status === 'searching' && (
          <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--primary, #6366f1)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)' }}>Verifying signature proof...</span>
          </div>
        )}

        {status === 'verified' && result && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* SVG Checkmark */}
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '12px', animation: 'scaleUp 0.3s ease' }}>
              <circle cx="12" cy="12" r="10" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2"/>
              <path d="M8 12l3 3 5-5" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: '#10b981' }}>✓ VERIFIED RECEIPT</h3>
            <p style={{ textAlign: 'center', margin: '0 0 20px 0', fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.4' }}>
              {result.antiTamperMessage}
            </p>

            <div 
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '24px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Receipt ID</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{result.receiptSummary.settlement.referenceNumber || result.receiptSummary.payment.paymentId.substring(0, 15)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '10px' }}>
                  {result.paymentDetails.paymentDetails.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Amount Settled</span>
                <strong style={{ fontSize: '14px', color: 'var(--text)' }}>
                  {result.paymentDetails.paymentDetails.fiatCurrency} {Number(result.paymentDetails.paymentDetails.fiatAmount).toFixed(2)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Merchant</span>
                <span style={{ textAlign: 'right' }}>
                  <div>{result.paymentDetails.merchant.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{result.paymentDetails.paymentDetails.paymentRail} • {result.paymentDetails.paymentDetails.country}</div>
                </span>
              </div>
              {result.receiptSummary.settlement.utr && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>UTR Number</span>
                  <span style={{ fontFamily: 'monospace' }}>{result.receiptSummary.settlement.utr}</span>
                </div>
              )}
              {result.paymentDetails.blockchain.confirmTxHash && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>On-Chain Hash</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--primary, #6366f1)' }}>
                    {result.paymentDetails.blockchain.confirmTxHash.substring(0, 10)}...{result.paymentDetails.blockchain.confirmTxHash.slice(-8)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Settled At</span>
                <span>{new Date(result.paymentDetails.paymentDetails.timestamp).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                <span>Views: {result.receiptSummary.meta.viewCount || 1}</span>
                <span>Security signature matches</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button 
                onClick={handleDownloadPDF}
                style={{ flex: 1, background: 'var(--primary, #6366f1)', border: 'none', borderRadius: '10px', padding: '10px', color: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Download PDF
              </button>
              <button 
                onClick={() => setStatus('idle')}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}
              >
                Verify Another
              </button>
            </div>
          </div>
        )}

        {status === 'tampered' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '12px' }}>
              <circle cx="12" cy="12" r="10" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="2"/>
              <path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: '#ef4444' }}>✗ INVALID SIGNATURE</h3>
            <p style={{ textAlign: 'center', margin: '0 0 24px 0', fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.4' }}>
              This receipt's cryptographic signature could not be validated. The transaction data may have been altered since issuance.
            </p>

            {reportSuccess ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', borderRadius: '8px', padding: '12px', fontSize: '12px', marginBottom: '20px', width: '100%', textAlign: 'center' }}>
                ✓ Report submitted. Our security desk will review this entry immediately.
              </div>
            ) : (
              <form onSubmit={handleReportReceipt} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', alignSelf: 'flex-start' }}>Report Suspicious Receipt</div>
                <input 
                  type="email" 
                  required
                  placeholder="Your Email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', outline: 'none' }}
                />
                <textarea 
                  required
                  rows={3}
                  placeholder="How did you receive this receipt? What issues did you note?"
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-tertiary, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px', outline: 'none', resize: 'none' }}
                />
                <button 
                  type="submit"
                  disabled={reporting}
                  style={{ background: '#ef4444', border: 'none', borderRadius: '8px', padding: '10px', color: '#ffffff', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
                >
                  {reporting ? 'Reporting...' : 'Report Receipt Fraud'}
                </button>
              </form>
            )}

            <button 
              onClick={() => setStatus('idle')}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}
            >
              Back to Search
            </button>
          </div>
        )}

        {status === 'not_found' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '12px' }}>
              <circle cx="12" cy="12" r="10" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" strokeWidth="2"/>
              <path d="M12 9v4M12 15h.01" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: '#f59e0b' }}>Receipt Not Found</h3>
            <p style={{ textAlign: 'center', margin: '0 0 20px 0', fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.4' }}>
              No payment record matching this identifier was found in PharosPay's system. Please check spelling or confirm payout completion.
            </p>

            <button 
              onClick={() => setStatus('idle')}
              style={{ width: '100%', background: 'var(--primary, #6366f1)', border: 'none', borderRadius: '10px', padding: '10px', color: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              Try Another Search
            </button>
          </div>
        )}

        {status === 'wallet_list' && (
          <div style={{ width: '100%' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>Payments for {walletShort}</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: 'var(--text-secondary)' }}>Showing last 20 transactions. Click on a row to verify cryptographic proof.</p>

            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 4px' }}>Payment ID</th>
                    <th style={{ padding: '8px 4px' }}>Amount</th>
                    <th style={{ padding: '8px 4px' }}>Status</th>
                    <th style={{ padding: '8px 4px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr 
                      key={p.paymentId} 
                      onClick={() => handleRowClick(p.paymentId)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', hover: { background: 'rgba(255,255,255,0.02)' } }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 4px', fontFamily: 'monospace' }}>{p.paymentId.substring(0, 10)}...</td>
                      <td style={{ padding: '10px 4px', fontWeight: 600 }}>{p.amount}</td>
                      <td style={{ padding: '10px 4px' }}>{p.status}</td>
                      <td style={{ padding: '10px 4px', color: 'var(--text-secondary)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button 
              onClick={() => setStatus('idle')}
              style={{ width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}
            >
              Back to Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
