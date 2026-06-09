import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import { Ic } from '../components/Icons';

export default function ReceiptPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (paymentId) {
      fetchReceipt();
    }
  }, [paymentId]);

  const fetchReceipt = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/receipts/verify?q=${encodeURIComponent(paymentId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification query failed.');
      }
      if (data.verified) {
        setReceipt(data);
      } else {
        setError(data.reason || 'receipt_not_found');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!receipt || !receipt.receiptSummary) return;
    const id = receipt.receiptSummary.payment.paymentId;
    window.open(`${API_BASE}/receipts/${id}/pdf`, '_blank');
  };

  const handleCopy = async () => {
    if (!receipt || !receipt.receiptSummary) return;
    const summary = receipt.receiptSummary;
    const text = [
      `PharosPay Verified Receipt`,
      `=========================`,
      `Payment ID: ${summary.settlement.referenceNumber || summary.payment.paymentId}`,
      `Amount: ${receipt.paymentDetails.paymentDetails.fiatCurrency} ${Number(receipt.paymentDetails.paymentDetails.fiatAmount).toFixed(2)}`,
      `Merchant: ${receipt.paymentDetails.merchant.name}`,
      `Status: ${receipt.paymentDetails.paymentDetails.status}`,
      summary.settlement.utr ? `${receipt.paymentDetails.utrLabel || 'Bank UTR'}: ${summary.settlement.utr}` : null,
      receipt.paymentDetails.blockchain?.txHash ? `Transaction Hash: ${receipt.paymentDetails.blockchain.txHash}` : null,
      receipt.paymentDetails.blockchain?.txHash ? `Explorer Link: https://atlantic.pharosscan.xyz/tx/${receipt.paymentDetails.blockchain.txHash}` : null,
      `Date: ${new Date(receipt.paymentDetails.paymentDetails.timestamp).toLocaleString()}`,
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const qrTargetUrl = window.location.href;

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
          maxWidth: '560px',
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--primary, #6366f1)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary, #94a3b8)' }}>Fetching cryptographic receipt...</span>
          </div>
        ) : error ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '12px' }}>
              <circle cx="12" cy="12" r="10" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="2"/>
              <path d="M12 9v4M12 15h.01" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: '#ef4444' }}>Receipt Error</h3>
            <p style={{ textAlign: 'center', margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-secondary, #94a3b8)' }}>
              Could not retrieve payment receipt details. Reason: {error.replace('_', ' ')}.
            </p>
            <button 
              onClick={() => navigate('/verify')}
              style={{ width: '100%', background: 'var(--primary, #6366f1)', border: 'none', borderRadius: '10px', padding: '10px', color: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              Back to Verification Portal
            </button>
          </div>
        ) : receipt && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* SVG Checkmark */}
            <svg width="65" height="65" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '12px' }}>
              <circle cx="12" cy="12" r="10" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2"/>
              <path d="M8 12l3 3 5-5" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>

            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#10b981' }}>✓ VERIFIED RECEIPT</h3>
            <p style={{ textAlign: 'center', margin: '0 0 24px 0', fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.4' }}>
              {receipt.antiTamperMessage}
            </p>

            {/* Redesigned Coinbase/Stripe Card Details */}
            <div 
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '16px',
                padding: '20px',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '24px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment ID</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {receipt.receiptSummary.settlement.referenceNumber || receipt.receiptSummary.payment.paymentId}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '10.5px' }}>
                  {receipt.paymentDetails.paymentDetails.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Payment Amount</span>
                <strong style={{ fontSize: '15px', color: 'var(--text)' }}>
                  {receipt.paymentDetails.paymentDetails.fiatCurrency} {Number(receipt.paymentDetails.paymentDetails.fiatAmount).toFixed(2)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Merchant</span>
                <span style={{ textAlign: 'right' }}>
                  <div>{receipt.paymentDetails.merchant.name}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                    {receipt.paymentDetails.paymentDetails.paymentRail} • {receipt.paymentDetails.paymentDetails.country}
                  </div>
                </span>
              </div>
              {receipt.receiptSummary.settlement.utr && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{receipt.paymentDetails.utrLabel || 'Bank UTR'}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{receipt.receiptSummary.settlement.utr}</span>
                </div>
              )}
              {receipt.paymentDetails.blockchain?.txHash && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transaction Hash</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text)' }}>
                      {receipt.paymentDetails.blockchain.txHash.substring(0, 10)}...{receipt.paymentDetails.blockchain.txHash.slice(-8)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Explorer</span>
                    <a 
                      href={`https://atlantic.pharosscan.xyz/tx/${receipt.paymentDetails.blockchain.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: 'monospace', color: 'var(--primary, #6366f1)', textDecoration: 'none', fontWeight: 700 }}
                    >
                      https://atlantic.pharosscan.xyz/tx/{receipt.paymentDetails.blockchain.txHash.substring(0, 8)}...
                    </a>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Settled Timestamp</span>
                <span>{new Date(receipt.paymentDetails.paymentDetails.timestamp).toLocaleString()}</span>
              </div>

              {/* QR Verification Block */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Verify URL</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--primary)', wordBreak: 'break-all', fontWeight: 600 }}>{qrTargetUrl}</span>
                </div>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrTargetUrl)}`} 
                  alt="Verify QR" 
                  style={{ width: '70px', height: '70px', background: '#fff', padding: '2px', border: '1px solid var(--border)', borderRadius: '6px', flexShrink: 0 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button 
                  onClick={handleDownloadPDF}
                  style={{ flex: 1, background: 'var(--primary, #6366f1)', border: 'none', borderRadius: '12px', padding: '12px', color: '#ffffff', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Ic name="dl" size={14} color="#fff" /> Download PDF
                </button>
                <button 
                  onClick={handleCopy}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Ic name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied Summary!' : 'Copy Summary'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button 
                  onClick={handlePrint}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Ic name="share" size={14} /> Print Receipt
                </button>
                <button 
                  onClick={() => navigate('/verify')}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: 'var(--text)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  Verify Another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
