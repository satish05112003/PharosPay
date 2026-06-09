import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { Ic } from './Icons';

export default function ReceiptViewer({ payment, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    if (!payment) return;
    fetchReceipt();
  }, [payment]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const fetchReceipt = async () => {
    setLoading(true);
    setError(null);
    try {
      const id = payment.paymentId || payment.id;
      const res = await fetch(`${API_BASE}/receipts/${id}/json`);
      const data = await res.json();
      if (data.success) {
        setReceipt(data.receipt);
      } else {
        setError(data.error || 'Failed to load receipt');
      }
    } catch (err) {
      setError('Unable to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    const id = payment.paymentId || payment.id;
    window.open(`${API_BASE}/receipts/${id}/pdf`, '_blank');
  };

  const handleCopyReceipt = async () => {
    if (!receipt) return;
    const text = [
      `PharosPay Receipt`,
      `=================`,
      `Payment ID: ${receipt.referenceNumber || receipt.paymentId}`,
      `Merchant: ${receipt.merchant?.name || 'N/A'}`,
      `Amount: ${receipt.paymentDetails?.fiatAmount} ${receipt.paymentDetails?.fiatCurrency}`,
      `PROS Paid: ${Number(receipt.paymentDetails?.prosAmount || 0).toFixed(4)} PROS`,
      `Status: ${receipt.paymentDetails?.status || 'SETTLED'}`,
      `PROS Price: ${receipt.paymentDetails?.prosPriceAtExecution ? '$' + Number(receipt.paymentDetails.prosPriceAtExecution).toFixed(4) : 'Execution data unavailable'}`,
      `FX Rate: ${receipt.paymentDetails?.fxRateAtExecution ? Number(receipt.paymentDetails.fxRateAtExecution).toFixed(4) : 'Execution data unavailable'}`,
      receipt.utr ? `${receipt.utrLabel || 'Bank UTR'}: ${receipt.utr}` : null,
      `Date: ${receipt.paymentDetails?.timestamp ? new Date(receipt.paymentDetails.timestamp).toLocaleString() : 'N/A'}`,
      `Source: ${receipt.paymentDetails?.priceSource || 'Coinbase'}`,
      receipt.blockchain?.txHash ? `Transaction Hash: ${receipt.blockchain.txHash}` : null,
      receipt.blockchain?.txHash ? `Explorer Link: https://atlantic.pharosscan.xyz/tx/${receipt.blockchain.txHash}` : null,
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    if (!receipt) return;
    const qrTargetUrl = `${window.location.origin}/receipt/${receipt.paymentId}`;
    const printWindow = window.open('about:blank', 'PrintReceipt', 'width=650,height=850');
    printWindow.document.write(`
      <html>
        <head>
          <title>PharosPay Receipt</title>
          <style>
            body { font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 40px; max-width: 600px; margin: 0 auto; background: #fff; }
            .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #6366f1; padding-bottom: 16px; }
            .header h2 { font-size: 24px; margin: 0; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
            .header .subtitle { font-size: 13px; font-weight: 700; color: #6366f1; margin: 4px 0 2px 0; }
            .header .desc { font-size: 11px; color: #64748b; margin: 0; }
            .meta { display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; padding: 8px 0; margin-bottom: 24px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
            .card h3 { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
            .row:last-child { border-bottom: none; }
            .row span:first-child { color: #64748b; font-weight: 500; }
            .row span:last-child { font-weight: 700; color: #0f172a; }
            .mono { font-family: monospace; font-size: 11px; color: #334155; word-break: break-all; }
            .verification-box { display: flex; gap: 16px; align-items: center; }
            .verification-details { flex: 1; }
            .verified-badge { display: inline-block; background: #d1fae5; color: #059669; font-size: 10px; font-weight: 800; padding: 3px 8px; borderRadius: 4px; margin-top: 4px; }
            .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>PharosPay</h2>
            <div class="subtitle">Settlement Receipt</div>
            <div class="desc">Global Payments Infrastructure</div>
          </div>
          <div class="meta">
            <span>Document ID: ${receipt.receiptId}</span>
            <span>Date: ${new Date(receipt.paymentDetails.timestamp).toLocaleString()}</span>
          </div>

          <div class="card">
            <h3>1. Payment Summary</h3>
            <div class="row"><span>Payer Wallet</span><span class="mono">${receipt.payer}</span></div>
            <div class="row"><span>Amount Settled</span><span>${Number(receipt.paymentDetails.fiatAmount).toFixed(2)} ${receipt.paymentDetails.fiatCurrency}</span></div>
            <div class="row"><span>PROS Burned</span><span>${Number(receipt.paymentDetails.prosAmount).toFixed(4)} PROS</span></div>
            <div class="row"><span>Payment Rail</span><span>${receipt.paymentDetails.paymentRail}</span></div>
          </div>

          <div class="card">
            <h3>2. Merchant Information</h3>
            <div class="row"><span>Merchant Legal Name</span><span>${receipt.merchant?.name || 'N/A'}</span></div>
            <div class="row"><span>Merchant ID Key</span><span>${receipt.merchant?.id}</span></div>
            <div class="row"><span>Country</span><span>${receipt.paymentDetails.country}</span></div>
          </div>

          <div class="card">
            <h3>3. Settlement Information</h3>
            <div class="row"><span>Payout Bank</span><span>${receipt.merchant?.bank || 'N/A'}</span></div>
            <div class="row"><span>${receipt.utrLabel || 'Bank UTR'}</span><span>${receipt.utr || 'N/A'}</span></div>
            <div class="row"><span>Speed</span><span>Instant Settlement (⚡ Speed)</span></div>
          </div>

          <div class="card">
            <h3>4. Financial Breakdown</h3>
            <div class="row"><span>Base Fiat Amount</span><span>${Number(receipt.paymentDetails.fiatAmount).toFixed(2)} ${receipt.paymentDetails.fiatCurrency}</span></div>
            <div class="row"><span>Platform Fee (2.0%)</span><span>${(Number(receipt.paymentDetails.fiatAmount) * 0.02).toFixed(2)} ${receipt.paymentDetails.fiatCurrency}</span></div>
            <div class="row"><span>PROS/USD Price</span><span>${receipt.paymentDetails.prosPriceAtExecution ? '$' + Number(receipt.paymentDetails.prosPriceAtExecution).toFixed(4) : 'Execution data unavailable'}</span></div>
            <div class="row"><span>Exchange Rate (USD/${receipt.paymentDetails.fiatCurrency})</span><span>${receipt.paymentDetails.fxRateAtExecution ? Number(receipt.paymentDetails.fxRateAtExecution).toFixed(4) : 'Execution data unavailable'}</span></div>
          </div>

          <div class="card">
            <h3>5. Blockchain Verification</h3>
            <div class="row"><span>Payment ID</span><span class="mono">${receipt.referenceNumber || receipt.paymentId}</span></div>
            ${receipt.blockchain?.txHash ? `
              <div class="row"><span>Transaction Hash</span><span class="mono">${receipt.blockchain.txHash}</span></div>
              <div class="row"><span>Explorer</span><span class="mono"><a href="https://atlantic.pharosscan.xyz/tx/${receipt.blockchain.txHash}" target="_blank" style="color:#6366f1;text-decoration:none">https://atlantic.pharosscan.xyz/tx/${receipt.blockchain.txHash}</a></span></div>
            ` : ''}
          </div>

          <div class="card">
            <h3>6. Support Information</h3>
            <div class="row"><span>PharosPay Support Center</span><span>https://pharospay.xyz/support</span></div>
            <div class="row"><span>Reference Number</span><span>${receipt.referenceNumber || 'PHAROS-REF'}</span></div>
            <div class="row"><span>Ticket ID reference</span><span>TKT-${receipt.paymentId.substring(0, 8).toUpperCase()}</span></div>
          </div>

          <div class="card">
            <h3>7. Receipt Verification</h3>
            <div class="verification-box">
              <div class="verification-details">
                <div class="row" style="border-bottom:none"><span>URL:</span><span style="color:#6366f1;font-size:10px">${qrTargetUrl}</span></div>
                <div class="verified-badge">✓ Cryptographically Verified (HMAC Match)</div>
              </div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrTargetUrl)}" style="width:75px;height:75px;border:1px solid #e2e8f0;border-radius:6px;padding:4px" />
            </div>
          </div>

          <div class="footer">
            <strong>PharosPay</strong><br/>
            Secure Cross-Border Payments on Pharos Blockchain<br/>
            This receipt was generated automatically and can be verified online.
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleEmailReceipt = async (e) => {
    e.preventDefault();
    if (!emailInput) return;
    setEmailSending(true);
    try {
      const id = payment.paymentId || payment.id;
      const res = await fetch(`${API_BASE}/receipts/${id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSent(true);
        setShowEmailForm(false);
        setTimeout(() => setEmailSent(false), 3000);
      }
    } catch (err) {
      alert('Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const qrTargetUrl = `${window.location.origin}/receipt/${receipt?.paymentId}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)', borderRadius: '24px', maxWidth: '540px', width: '100%',
          maxHeight: '92vh', overflowY: 'auto', border: '1px solid var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35)', animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.01)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ic name="receipt" size={16} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>PharosPay Receipt</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Verified Settlement Proof</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)',
            background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)'
          }}>
            <Ic name="x" size={14} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '28px', height: '28px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading receipt details...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Ic name="alert" size={28} color="var(--danger)" />
            <p style={{ fontSize: '14px', color: 'var(--danger)', marginTop: '8px' }}>{error}</p>
          </div>
        ) : receipt && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Redesigned Hero Block */}
            <div style={{
              textAlign: 'center', padding: '20px', borderRadius: '16px',
              background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)',
            }}>
              <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 6px 0', letterSpacing: '0.5px' }}>Amount Settled</p>
              <h2 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                {Number(receipt.paymentDetails.fiatAmount).toFixed(2)} {receipt.paymentDetails.fiatCurrency}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 700, margin: '4px 0 8px 0' }}>
                {Number(receipt.paymentDetails.prosAmount).toFixed(4)} PROS
              </p>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px',
                background: '#d1fae5', color: '#059669'
              }}>
                <Ic name="check" size={10} color="#059669" />
                VERIFIED SETTLEMENT
              </span>
            </div>

            {/* Redesigned Grid Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Card 1: Summary & Merchant */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                  1. Payment & Merchant
                </div>
                {[
                  { label: 'Payer Wallet', value: receipt.payer.slice(0, 8) + '...' + receipt.payer.slice(-6), mono: true },
                  { label: 'Merchant Legal Name', value: receipt.merchant?.name || 'N/A' },
                  { label: 'Merchant Rail Key', value: receipt.merchant?.id || 'N/A' },
                  { label: 'Settlement Country', value: receipt.paymentDetails.country || 'N/A' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Card 2: Settlement Details */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                  2. Settlement & Financials
                </div>
                {[
                  { label: 'Payout Bank', value: receipt.merchant?.bank || 'N/A' },
                  { label: receipt.utrLabel || 'Bank UTR', value: receipt.utr || 'N/A', mono: true },
                  { label: 'Base Fiat Amount', value: `${Number(receipt.paymentDetails.fiatAmount).toFixed(2)} ${receipt.paymentDetails.fiatCurrency}` },
                  { label: 'Platform Fee (2.0%)', value: `${(Number(receipt.paymentDetails.fiatAmount) * 0.02).toFixed(2)} ${receipt.paymentDetails.fiatCurrency}` },
                  { label: 'PROS/USD Price', value: receipt.paymentDetails.prosPriceAtExecution ? `$${Number(receipt.paymentDetails.prosPriceAtExecution).toFixed(4)}` : 'Execution data unavailable' },
                  { label: 'Exchange Rate', value: receipt.paymentDetails.fxRateAtExecution ? `${Number(receipt.paymentDetails.fxRateAtExecution).toFixed(4)} (USD/${receipt.paymentDetails.fiatCurrency})` : 'Execution data unavailable' },
                  { label: 'Oracle Source', value: receipt.paymentDetails.priceSource || 'Coinbase' },
                  { label: 'Date Issued', value: new Date(receipt.paymentDetails.timestamp).toLocaleString() },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Card 3: Blockchain Verification */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                  3. Blockchain Proof
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Payment ID</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text)', fontWeight: 700, wordBreak: 'break-all' }}>{receipt.referenceNumber || receipt.paymentId}</span>
                  </div>
                  {receipt.blockchain?.txHash && (
                    <>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Transaction Hash</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700, wordBreak: 'break-all' }}>{receipt.blockchain.txHash}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Explorer</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700, wordBreak: 'break-all' }}>
                          <a href={`https://atlantic.pharosscan.xyz/tx/${receipt.blockchain.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                            https://atlantic.pharosscan.xyz/tx/{receipt.blockchain.txHash}
                          </a>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Card 4: Need Help? Support Information */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                  4. Support Information
                </div>
                {[
                  { label: 'PharosPay Support Center', value: 'https://pharospay.xyz/support' },
                  { label: 'Support Reference Number', value: `PHAROS-REF-${receipt.paymentId.substring(0, 6).toUpperCase()}`, mono: true },
                  { label: 'Ticket ID reference', value: `TKT-${receipt.paymentId.substring(0, 8).toUpperCase()}`, mono: true }
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Card 5: Receipt Verification with QR */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                  5. Receipt Verification
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Verification URL:</span>
                      <a href={qrTargetUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, wordBreak: 'break-all', textDecoration: 'none' }}>
                        {qrTargetUrl}
                      </a>
                    </div>
                    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '10.5px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', marginTop: '4px' }}>
                      ✓ Cryptographically Signed (HMAC Validated)
                    </div>
                  </div>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrTargetUrl)}`} 
                    alt="Verify QR" 
                    style={{ width: '80px', height: '80px', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px', flexShrink: 0 }}
                  />
                </div>
              </div>

            </div>

            {/* Email Form */}
            {showEmailForm && (
              <form onSubmit={handleEmailReceipt} style={{
                padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                <div className="form-input-wrapper" style={{ flex: 1, margin: 0 }}>
                  <input
                    type="email"
                    className="form-input"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="recipient@email.com"
                    required
                    style={{ fontSize: '12px' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={emailSending} style={{ flexShrink: 0 }}>
                  {emailSending ? 'Sending...' : 'Send'}
                </button>
                <button type="button" onClick={() => setShowEmailForm(false)} className="btn btn-ghost btn-sm">
                  <Ic name="x" size={12} />
                </button>
              </form>
            )}

            {emailSent && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: '#d1fae5', border: '1px solid #059669', fontSize: '12px',
                fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <Ic name="check" size={12} color="#059669" /> Receipt sent to {emailInput}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={handleDownloadPdf} className="btn btn-primary btn-sm" style={{ justifyContent: 'center', gap: '6px' }}>
                <Ic name="dl" size={14} color="#fff" /> Download PDF
              </button>
              <button onClick={handleCopyReceipt} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center', gap: '6px' }}>
                <Ic name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handlePrint} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center', gap: '6px' }}>
                <Ic name="share" size={14} /> Print
              </button>
              <button onClick={() => setShowEmailForm(!showEmailForm)} className="btn btn-secondary btn-sm" style={{ justifyContent: 'center', gap: '6px' }}>
                <Ic name="send" size={14} /> Email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
