import { useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, ABI, CURRENCIES, API_BASE, APP_CONFIG } from '../config';

export default function ConfirmPayment({ paymentData, wallet, onSuccess, onError }) {
  const [status, setStatus] = useState('idle'); // idle | approving | paying | confirming | settled | failed

  const currencyConfig = CURRENCIES[paymentData.currency] || CURRENCIES.USD;

  const executePayment = async () => {
    if (!wallet.signer || !wallet.isConnected) {
      onError('Wallet not connected');
      return;
    }

    if (!CONTRACTS.PharosPayRouter || !CONTRACTS.MockPROS) {
      onError('Contract addresses not configured. Deploy contracts first.');
      return;
    }

    try {
      const router = new ethers.Contract(CONTRACTS.PharosPayRouter, ABI.PharosPayRouter, wallet.signer);
      const pros = new ethers.Contract(CONTRACTS.MockPROS, ABI.MockPROS, wallet.signer);

      // Step 1: Check and set approval
      setStatus('approving');
      const totalWei = ethers.parseEther(paymentData.quote.totalPros.toString());
      const currentAllowance = await pros.allowance(wallet.address, CONTRACTS.PharosPayRouter);

      if (currentAllowance < totalWei) {
        const approveTx = await pros.approve(CONTRACTS.PharosPayRouter, totalWei);
        await approveTx.wait();
      }

      // Step 2: Execute payment
      setStatus('paying');
      const fiatAmountWei = ethers.parseEther(paymentData.amount.toString());

      const tx = await router.pay(
        paymentData.merchantId,
        paymentData.merchantName || 'Merchant',
        paymentData.currency,
        fiatAmountWei,
        paymentData.fiatPair,
        paymentData.paymentRail,
        paymentData.country || 'US'
      );

      // Step 3: Wait for confirmation
      setStatus('confirming');
      const receipt = await tx.wait();

      // Step 4: Simulate settlement via backend
      setStatus('settled');
      try {
        await fetch(`${API_BASE}/settle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: receipt.logs?.[0]?.topics?.[1] || '0x',
            txHash: receipt.hash,
            merchantId: paymentData.merchantId,
            merchantName: paymentData.merchantName,
            amount: paymentData.amount,
            currency: paymentData.currency,
            paymentRail: paymentData.paymentRail,
            country: paymentData.country,
          }),
        });
      } catch {
        // Settlement simulation is optional for demo
      }

      // Refresh wallet balances
      wallet.refreshBalances();

      onSuccess({
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        merchantId: paymentData.merchantId,
        merchantName: paymentData.merchantName,
        fiatAmount: paymentData.amount,
        currency: paymentData.currency,
        prosAmount: paymentData.quote.totalPros,
        feeAmount: paymentData.quote.feeAmount,
        paymentRail: paymentData.paymentRail,
        country: paymentData.country,
      });
    } catch (err) {
      setStatus('failed');
      const message = err.reason || err.message || 'Transaction failed';
      onError(message.includes('user rejected') ? 'Transaction rejected by user' : message);
    }
  };

  return (
    <div className="fade-in">
      <div className="glass-card accent">
        <h3 style={{ marginBottom: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>
          Confirm Payment
        </h3>

        {/* Merchant */}
        <div className="merchant-info" style={{ marginBottom: '16px' }}>
          <div className="merchant-avatar">{paymentData.countryFlag || '🏪'}</div>
          <div className="merchant-details">
            <div className="merchant-name">{paymentData.merchantName}</div>
            <div className="merchant-id">{paymentData.merchantId}</div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="quote-breakdown">
          <div className="quote-row">
            <span className="label">Merchant Receives</span>
            <span className="value">{currencyConfig.symbol}{paymentData.amount}</span>
          </div>
          <div className="quote-row">
            <span className="label">Via</span>
            <span className="value">{paymentData.paymentRail} {currencyConfig.flag}</span>
          </div>
          <div className="quote-row">
            <span className="label">{APP_CONFIG.tokenSymbol} Amount</span>
            <span className="value">{paymentData.quote.merchantPros} {APP_CONFIG.tokenSymbol}</span>
          </div>
          <div className="quote-row fee">
            <span className="label">Platform Fee ({paymentData.quote.feePercent}%)</span>
            <span className="value">+{paymentData.quote.feeAmount} {APP_CONFIG.tokenSymbol}</span>
          </div>
          <div className="quote-row total">
            <span className="label">Total Deduction</span>
            <span className="value">{paymentData.quote.totalPros} {APP_CONFIG.tokenSymbol}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {status === 'idle' && (
          <>
            <button className="btn-primary" onClick={executePayment} style={{ marginTop: '16px' }}>
              <span>🔐 Pay {paymentData.quote.totalPros} {APP_CONFIG.tokenSymbol}</span>
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
              MetaMask will ask for approval, then payment confirmation
            </p>
          </>
        )}

        {/* Status Messages */}
        {status === 'approving' && (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--pharos-light)' }}>Approving {APP_CONFIG.tokenSymbol} spending...</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confirm in MetaMask</p>
          </div>
        )}

        {status === 'paying' && (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--pharos-light)' }}>Executing payment...</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confirm in MetaMask</p>
          </div>
        )}

        {status === 'confirming' && (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--accent-gold)' }}>Waiting for block confirmation...</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>This usually takes 3-5 seconds</p>
          </div>
        )}

        {status === 'failed' && (
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <p style={{ color: 'var(--danger)', marginBottom: '12px' }}>❌ Transaction Failed</p>
            <button className="btn-secondary" onClick={() => setStatus('idle')}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}
