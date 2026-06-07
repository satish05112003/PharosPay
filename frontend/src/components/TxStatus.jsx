import { getExplorerTxUrl } from '../hooks/useContract';
import { CURRENCIES } from '../config';

export default function TxStatus({ result, onReset }) {
  if (!result) return null;

  const currencyConfig = CURRENCIES[result.currency] || CURRENCIES.USD;
  const explorerUrl = getExplorerTxUrl(result.txHash);

  return (
    <div className="fade-in">
      {/* Success Icon */}
      <div className="tx-status">
        <div className="status-icon confirmed">✓</div>
        <h2 style={{ color: 'var(--success)' }}>Payment Successful!</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Transaction confirmed on Pharos Network
        </p>
      </div>

      {/* Settlement Banner */}
      <div className="settlement-banner">
        <div className="merchant-received">
          {currencyConfig.symbol}{result.fiatAmount}
        </div>
        <div className="via-rail">
          → {result.merchantName} via {result.paymentRail} {currencyConfig.flag}
        </div>
        <div className="simulated-tag">Settlement Simulated</div>
      </div>

      {/* Payment Details */}
      <div className="glass-card" style={{ marginTop: '16px' }}>
        <div className="quote-breakdown">
          <div className="quote-row">
            <span className="label">Merchant</span>
            <span className="value">{result.merchantName}</span>
          </div>
          <div className="quote-row">
            <span className="label">Merchant ID</span>
            <span className="value" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {result.merchantId}
            </span>
          </div>
          <div className="quote-row">
            <span className="label">Amount</span>
            <span className="value">{currencyConfig.symbol}{result.fiatAmount}</span>
          </div>
          <div className="quote-row">
            <span className="label">PROS Paid</span>
            <span className="value">{result.prosAmount} PROS</span>
          </div>
          <div className="quote-row fee">
            <span className="label">Platform Fee</span>
            <span className="value">{result.feeAmount} PROS</span>
          </div>
          <div className="quote-row">
            <span className="label">Payment Rail</span>
            <span className="value">{result.paymentRail}</span>
          </div>
        </div>
      </div>

      {/* Transaction Hash */}
      <div className="tx-status" style={{ paddingTop: '12px' }}>
        <div className="tx-hash">
          Tx: <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
            {result.txHash}
          </a>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{ flex: 1, textAlign: 'center' }}
        >
          🔍 View on Explorer
        </a>
        <button className="btn-primary" style={{ flex: 1 }} onClick={onReset}>
          <span>New Payment</span>
        </button>
      </div>
    </div>
  );
}
