import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { CONTRACTS, ABI, CURRENCIES, API_BASE, APP_CONFIG } from '../config';
import { formatTokenAmount, parseFiatAmount, getExplorerTxUrl } from '../hooks/useContract';
import { Ic } from '../components/Icons';
import { usePayments } from '../context/PaymentContext';
import ReceiptViewer from '../components/ReceiptViewer';

const COUNTRIES = [
  { id: "IN", name: "India", flag: "🇮🇳", currency: "INR", rate: 83.56, methods: ["UPI", "Bank Transfer"] },
  { id: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", rate: 5.12, methods: ["PIX", "Bank Transfer"] },
  { id: "SG", name: "Singapore", flag: "🇸🇬", currency: "SGD", rate: 1.34, methods: ["PayNow", "Bank Transfer"] },
  { id: "US", name: "USA", flag: "🇺🇸", currency: "USD", rate: 1.00, methods: ["ACH", "Bank Transfer"] },
  { id: "TH", name: "Thailand", flag: "🇹🇭", currency: "THB", rate: 35.20, methods: ["PromptPay"] },
  { id: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", rate: 15750, methods: ["QRIS"] }
];

export default function Pay({ wallet }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Wizard Steps: 1: Select Country, 2: Select Method, 3: Merchant ID & Amount, 4: Quote, 5: Confirm, 6: Success Receipt
  const [step, setStep] = useState(1);
  const { refreshPayments } = usePayments();
  
  const [country, setCountry] = useState('IN');
  const [method, setMethod] = useState('UPI');
  const [merchantId, setMerchantId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('100');
  
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | approving | paying | confirming | settled | failed
  const [txResult, setTxResult] = useState(null);
  const [error, setError] = useState(null);

  const [recentMerchants, setRecentMerchants] = useState([]);

  // Merchant Registry verified state
  const [verifiedMerchant, setVerifiedMerchant] = useState(null);
  const [loadingMerchant, setLoadingMerchant] = useState(false);

  const selectedCountryInfo = COUNTRIES.find(c => c.id === country) || COUNTRIES[0];

  // ─── Live Quote Seconds Counter ──────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (quote && quote.lastUpdated) {
      const updateSeconds = () => {
        const diffMs = Date.now() - new Date(quote.lastUpdated).getTime();
        setSecondsSinceUpdate(Math.max(0, Math.floor(diffMs / 1000)));
      };
      updateSeconds();
      interval = setInterval(updateSeconds, 1000);
    } else {
      setSecondsSinceUpdate(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [quote]);

  // ─── Live Quote Auto-Refresh Loop (30s) ──────────────────────────────────
  useEffect(() => {
    let interval;
    if ((step === 4 || step === 5) && !loadingQuote && paymentStatus === 'idle') {
      interval = setInterval(() => {
        console.log("Auto-refreshing quote...");
        fetchQuote();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, loadingQuote, paymentStatus, amount, selectedCountryInfo]);

  // ─── Auto-Refresh Quote on Amount or Currency Change ─────────────────────
  useEffect(() => {
    if (step === 4 || step === 5) {
      console.log("Details changed. Re-fetching quote...");
      fetchQuote();
    }
  }, [amount, selectedCountryInfo]);

  // Restore Preferences and Recent Merchants on mount
  useEffect(() => {
    const savedCountry = localStorage.getItem('pharos_selected_country');
    const savedMethod = localStorage.getItem('pharos_selected_method');
    const savedRecents = localStorage.getItem('pharos_recent_merchants');

    if (savedCountry) {
      setCountry(savedCountry);
      const cInfo = COUNTRIES.find(c => c.id === savedCountry);
      if (cInfo && savedMethod && cInfo.methods.includes(savedMethod)) {
        setMethod(savedMethod);
      } else if (cInfo) {
        setMethod(cInfo.methods[0]);
      }
    }
    if (savedRecents) {
      setRecentMerchants(JSON.parse(savedRecents));
    }

    // Handle incoming scanner redirection payload
    if (location.state?.scannedMerchant) {
      const m = location.state.scannedMerchant;
      setCountry(m.country);
      setMethod(m.paymentRail);
      setMerchantId(m.merchantId);
      if (m.merchantName) setMerchantName(m.merchantName);
      if (m.amount) setAmount(m.amount.toString());
      setStep(3); // Go straight to entering amount & validating
    }
  }, [location.state]);

  // Look up merchant profile from registry on merchantId changes
  useEffect(() => {
    if (!merchantId) {
      setVerifiedMerchant(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingMerchant(true);
      try {
        const res = await fetch(`${API_BASE}/merchants/${merchantId}`);
        const data = await res.json();
        if (data.success && data.merchant) {
          setVerifiedMerchant(data.merchant);
          setMerchantName(data.merchant.businessName);
          setCountry(data.merchant.country);
          if (data.merchant.supportedRails && data.merchant.supportedRails.length > 0) {
            if (!data.merchant.supportedRails.includes(method)) {
              setMethod(data.merchant.supportedRails[0]);
            }
          }
        } else {
          setVerifiedMerchant(null);
        }
      } catch (err) {
        console.warn('Failed to query verified merchant:', err);
        setVerifiedMerchant(null);
      } finally {
        setLoadingMerchant(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [merchantId]);

  const selectCountry = (cId) => {
    setCountry(cId);
    localStorage.setItem('pharos_selected_country', cId);
    
    // Auto-select first method of the country
    const cInfo = COUNTRIES.find(c => c.id === cId);
    if (cInfo) {
      setMethod(cInfo.methods[0]);
      localStorage.setItem('pharos_selected_method', cInfo.methods[0]);
    }
    setStep(2);
  };

  const selectMethod = (mName) => {
    setMethod(mName);
    localStorage.setItem('pharos_selected_method', mName);
    setStep(3);
  };

  // Live validation logic
  const validateMerchantId = () => {
    if (verifiedMerchant) {
      return { isValid: true, provider: "Pharos Registry", text: "✓ Verified Merchant Profile" };
    }
    if (!merchantId) return { isValid: false, provider: "None", text: "Empty input" };

    if (method === 'UPI') {
      const isUpi = /^[\w.-]+@[\w.-]+$/.test(merchantId);
      if (isUpi) {
        let provider = "BHIM UPI";
        if (merchantId.endsWith('@ybl') || merchantId.endsWith('@ibl')) provider = "PhonePe";
        else if (merchantId.endsWith('@okaxis') || merchantId.endsWith('@okicici') || merchantId.endsWith('@oksbi')) provider = "Google Pay";
        else if (merchantId.endsWith('@paytm')) provider = "Paytm";
        return { isValid: true, provider, text: "UPI Format Detected" };
      }
      return { isValid: false, provider: "Unknown", text: "Invalid UPI ID format (username@bank)" };
    }

    if (method === 'PIX') {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merchantId);
      const isPhone = /^\+[1-9]\d{1,14}$/.test(merchantId);
      const isCpfCnpj = /^\d{11}$|^\d{14}$/.test(merchantId);
      const isKey = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(merchantId);

      if (isEmail) return { isValid: true, provider: "Email Key", text: "PIX Format Detected" };
      if (isPhone) return { isValid: true, provider: "Phone Number", text: "PIX Format Detected" };
      if (isCpfCnpj) return { isValid: true, provider: "National Tax ID (CPF/CNPJ)", text: "PIX Format Detected" };
      if (isKey) return { isValid: true, provider: "Random EVP Key", text: "PIX Format Detected" };
      
      return { isValid: false, provider: "Unknown", text: "Invalid PIX Key (use CPF, email, +Phone, or random UUID)" };
    }

    if (method === 'PayNow') {
      const isPhone = /^[89]\d{7}$|^\+65[89]\d{7}$/.test(merchantId);
      const isNric = /^[STFGM]\d{7}[A-Z]$/.test(merchantId);
      const isUen = /^\d{9}[A-Z]$|^\d{8}[A-Z]$|^T\d{2}[A-Z]{2}\d{4}[A-Z]$/.test(merchantId);

      if (isPhone) return { isValid: true, provider: "Mobile Number", text: "PayNow Format Detected" };
      if (isNric) return { isValid: true, provider: "NRIC/FIN Number", text: "PayNow Format Detected" };
      if (isUen) return { isValid: true, provider: "Unique Entity UEN", text: "PayNow Format Detected" };

      return { isValid: false, provider: "Unknown", text: "Invalid PayNow Format (use Mobile, NRIC, or UEN)" };
    }

    if (method === 'ACH') {
      const isAch = /^\d{9}-\d{4,17}$/.test(merchantId);
      if (isAch) return { isValid: true, provider: "US Fedwire Routing & Bank Account", text: "ACH Format Detected" };
      return { isValid: false, provider: "Unknown", text: "Invalid ACH Format (routing-account e.g. 123456789-98765)" };
    }

    if (method === 'PromptPay') {
      const isPhone = /^0[689]\d{8}$|^\+66[689]\d{8}$/.test(merchantId);
      const isId = /^\d{13}$/.test(merchantId);
      if (isPhone) return { isValid: true, provider: "Mobile PromptPay", text: "PromptPay Format Detected" };
      if (isId) return { isValid: true, provider: "National ID", text: "PromptPay Format Detected" };
      return { isValid: false, provider: "Unknown", text: "Invalid PromptPay (use 10-digit Phone or 13-digit ID)" };
    }

    if (method === 'QRIS') {
      const isQris = merchantId.length >= 12;
      if (isQris) return { isValid: true, provider: "Indonesian QRIS Network", text: "QRIS Format Detected" };
      return { isValid: false, provider: "Unknown", text: "Invalid QRIS ID (Length must be 12+ digits)" };
    }

    if (method === 'Bank Transfer') {
      const isBank = merchantId.length > 5;
      if (isBank) return { isValid: true, provider: "Standard Bank Settlement", text: "Bank Identifier Format Detected" };
      return { isValid: false, provider: "Unknown", text: "Enter valid routing or account details" };
    }

    return { isValid: false, provider: "Unknown", text: "Validation not supported" };
  };

  const validationResult = validateMerchantId();

  // ─── Fetch Quote ────────────────────────────────────────────────────────
  const fetchQuote = async () => {
    if (!amount || parseFloat(amount) <= 0 || !validationResult.isValid) return;
    setLoadingQuote(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/quote?amount=${amount}&currency=${selectedCountryInfo.currency}`);
      const data = await res.json();

      if (data.success) {
        setQuote(data.quote);
        setError(null);
        setStep(4);
      } else {
        throw new Error(data.error || data.message || 'API quote failed');
      }
    } catch (err) {
      console.warn('Quote fetch failed:', err.message);
      setError(err.message === 'Market data unavailable' ? 'Market data unavailable. Refresh quote before paying.' : 'Market data unavailable. Please check connection and retry.');
    } finally {
      setLoadingQuote(false);
    }
  };

  // ─── Execute On-Chain Payment ───────────────────────────────────────────
  const executePayment = async () => {
    if (secondsSinceUpdate > 300) {
      setError('Market data unavailable. Refresh quote before paying.');
      return;
    }

    if (!wallet.signer || !wallet.isConnected) {
      setError('Wallet is not connected.');
      return;
    }
    if (!wallet.isCorrectNetwork) {
      setError('Stale network state. Switch to Pharos Atlantic Network.');
      return;
    }
    if (!CONTRACTS.PharosPayRouter || !CONTRACTS.MockPROS) {
      setError('Router contracts not configured.');
      return;
    }

    setPaymentStatus('approving');
    setError(null);

    try {
      const router = new ethers.Contract(CONTRACTS.PharosPayRouter, ABI.PharosPayRouter, wallet.signer);
      const pros = new ethers.Contract(CONTRACTS.MockPROS, ABI.MockPROS, wallet.signer);

      const totalWei = ethers.parseEther(quote.totalPros.toString());
      
      // Step 1: ERC20 Spend Allowance check
      const currentAllowance = await pros.allowance(wallet.address, CONTRACTS.PharosPayRouter);
      if (currentAllowance < totalWei) {
        const approveTx = await pros.approve(CONTRACTS.PharosPayRouter, totalWei);
        await approveTx.wait();
      }

      // Step 2: Pay Contract call
      setPaymentStatus('paying');
      const fiatAmountWei = parseFiatAmount(amount);
      const fiatPair = `USD/${selectedCountryInfo.currency}`;

      const tx = await router.pay(
        merchantId,
        merchantName || 'Merchant Store',
        selectedCountryInfo.currency,
        fiatAmountWei,
        fiatPair,
        method,
        country
      );

      // Step 3: Block Confirmation
      setPaymentStatus('confirming');
      const receipt = await tx.wait();

      // Step 4: simulated settlement service
      setPaymentStatus('settled');
      const paymentId = receipt.logs?.[0]?.topics?.[1] || '0x';
      
      let dbPaymentId = null;
      try {
        const settleRes = await fetch(`${API_BASE}/settle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId,
            txHash: receipt.hash,
            merchantId,
            merchantName: merchantName || 'Merchant Store',
            amount: parseFloat(amount),
            currency: selectedCountryInfo.currency,
            paymentRail: method,
            country,
            payer: wallet.address,
            prosAmount: quote.totalPros.toString(),
            feeAmount: quote.feeAmount.toString()
          }),
        });
        const settleData = await settleRes.json();
        if (settleData.success && settleData.settlement) {
          dbPaymentId = settleData.settlement.paymentId;
        }
      } catch (e) {
        console.warn('Settlement agent offline:', e.message);
      }

      // Add to recent merchants local preferences list
      saveMerchantLocally(merchantId, merchantName || 'Merchant Store', method, country);

      // Refresh balances and payments state
      wallet.refreshBalances();
      refreshPayments();

      setTxResult({
        id: dbPaymentId || paymentId,
        paymentId: dbPaymentId || paymentId,
        pharosPaymentId: paymentId,
        txHash: receipt.hash,
        merchantId,
        merchantName: merchantName || 'Merchant Store',
        fiatAmount: parseFloat(amount),
        currency: selectedCountryInfo.currency,
        prosAmount: quote.totalPros,
        feeAmount: quote.feeAmount,
        paymentRail: method,
        country,
        timestamp: new Date()
      });

      setStep(6); // Success screen receipt
    } catch (err) {
      setPaymentStatus('failed');
      const reason = err.reason || err.message || 'Transaction reverted';
      setError(reason.includes('user rejected') ? 'User rejected MetaMask signing.' : reason);
    }
  };

  const saveMerchantLocally = (id, name, rail, cCode) => {
    const recents = JSON.parse(localStorage.getItem('pharos_recent_merchants') || '[]');
    const filtered = recents.filter(m => m.id !== id);
    filtered.unshift({ id, name, rail, country: cCode, timestamp: Date.now() });
    localStorage.setItem('pharos_recent_merchants', JSON.stringify(filtered.slice(0, 5)));
  };

  const handleCopyReceipt = () => {
    if (!txResult) return;
    const txt = `PHAROSPAY RECEIPT\nMerchant: ${txResult.merchantName}\nCountry: ${txResult.country}\nRail: ${txResult.paymentRail}\nAmount: ${txResult.fiatAmount} ${txResult.currency}\nFee Paid: ${txResult.feeAmount} PROS\nPROS spent: ${txResult.prosAmount} PROS\nTx: ${txResult.txHash}`;
    navigator.clipboard.writeText(txt);
  };

  const handleDownloadPDF = () => {
    const printContent = document.getElementById('receipt-print-area').innerHTML;
    const printWindow = window.open('about:blank', 'PrintReceipt', 'left=50000,top=50000,width=0,height=0');
    printWindow.document.write(`
      <html>
        <head>
          <title>PharosPay Invoice Receipt</title>
          <style>
            body { font-family: 'DM Sans', sans-serif; color: #0f172a; padding: 40px; }
            .receipt { max-width: 460px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .total { font-weight: 800; font-size: 15px; border-top: 2px solid #e2e8f0; border-bottom: none; padding-top: 12px; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h3>PharosPay Payment Receipt</h3>
              <p style="font-size:12px;color:#64748b;">Instant Fiat Cross-border Settlement</p>
            </div>
            ${printContent}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  const handleReset = () => {
    setStep(1);
    setMerchantId('');
    setMerchantName('');
    setAmount('100');
    setQuote(null);
    setPaymentStatus('idle');
    setTxResult(null);
    setError(null);
  };

  // Render Step Navigation Line
  const StepBar = () => {
    const stepsLabels = ["Country", "Method", "Details", "Quote", "Confirm", "Receipt"];
    return (
      <div style={{ display: "flex", alignItems: "center", marginBottom: "28px", width: "100%" }}>
        {stepsLabels.map((lbl, idx) => (
          <React.Fragment key={lbl}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
              <div style={{ 
                width: "28px", 
                height: "28px", 
                borderRadius: "50%", 
                background: step > idx + 1 ? "var(--success)" : step === idx + 1 ? "var(--primary)" : "var(--bg-tertiary)",
                color: step >= idx + 1 ? "#fff" : "var(--text-tertiary)", 
                fontSize: "11px", 
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s"
              }}>
                {step > idx + 1 ? <Ic name="check" size={12} color="#fff" /> : idx + 1}
              </div>
              <span style={{ fontSize: "10px", fontWeight: step === idx + 1 ? 800 : 500, color: step === idx + 1 ? "var(--primary)" : "var(--text-tertiary)", marginTop: "4px", whiteSpace: "nowrap" }}>
                {lbl}
              </span>
            </div>
            {idx < stepsLabels.length - 1 && (
              <div style={{ 
                flex: 1, 
                height: "2px", 
                background: step > idx + 1 ? "var(--success)" : "var(--border)",
                margin: "0 6px 14px",
                transition: "background 0.2s"
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="page-enter" style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
      {/* Header Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        {step > 1 && step < 6 && (
          <button 
            className="btn btn-secondary" 
            onClick={() => setStep(step - 1)} 
            style={{ width: "36px", height: "36px", padding: 0 }}
          >
            <Ic name="arrowL" size={16} />
          </button>
        )}
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", margin: 0 }}>Payment Wizard</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            Instant local fiat settlement with PROS tokens
          </p>
        </div>
      </div>

      <StepBar />

      {/* Switching Network Warning block */}
      {wallet.isSwitchingNetwork && (
        <div style={{ background: "var(--warning-light)", border: "1px solid #fcd34d", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px", textAlign: "center" }}>
          <div style={{ width: "20px", height: "20px", border: "2px solid var(--warning-dark)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
          <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--warning-dark)", margin: 0 }}>
            Switching to Pharos Network...
          </p>
          <p style={{ fontSize: "11px", color: "var(--warning-dark)", marginTop: "2px" }}>
            Please approve the chain addition/switch request in MetaMask to enable checkout.
          </p>
        </div>
      )}

      {/* ERROR DISPLAY */}
      {error && (
        <div style={{ background: "var(--danger-light)", border: "1px solid #fca5a5", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px" }}>
          <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--danger-dark)", marginBottom: "4px" }}>
            Check Alert
          </p>
          <p style={{ fontSize: "12px", color: "var(--danger-dark)", margin: 0 }}>{error}</p>
        </div>
      )}

      {/* STEP 1: Select Country */}
      {step === 1 && (
        <div className="page-enter">
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>
            Select Recipient Country
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
            Specify the destination country for local payment delivery.
          </p>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: "12px" }}>
            {COUNTRIES.map(co => (
              <div 
                className="card interactive" 
                key={co.id}
                onClick={() => selectCountry(co.id)}
                style={{ 
                  padding: "18px", 
                  border: country === co.id ? "2px solid var(--primary)" : "1px solid var(--border)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "28px" }}>{co.flag}</span>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", margin: 0 }}>{co.name}</p>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>{co.currency}</p>
                  </div>
                </div>
                <span className="badge" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                  {co.methods.join(' / ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Select Method */}
      {step === 2 && (
        <div className="page-enter">
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>
            Choose Payment Method
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
            Select the rail the merchant uses for local settlements.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
            {selectedCountryInfo.methods.map(met => (
              <div 
                className="card interactive"
                key={met}
                onClick={() => selectMethod(met)}
                style={{ 
                  padding: "20px", 
                  border: method === met ? "2px solid var(--primary)" : "1px solid var(--border)",
                  textAlign: "center"
                }}
              >
                <div style={{ 
                  width: "48px", 
                  height: "48px", 
                  borderRadius: "50%", 
                  background: "var(--primary-light)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  margin: "0 auto 12px"
                }}>
                  <Ic name="send" size={20} color="var(--primary)" />
                </div>
                <p style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)", margin: 0 }}>{met}</p>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  Instant Settlement
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Identifier and Amount Inputs */}
      {step === 3 && (
        <div className="page-enter">
          {/* Chosen Country / Rail Summary */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "24px" }}>
            <span style={{ fontSize: "32px" }}>{selectedCountryInfo.flag}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", margin: 0 }}>{selectedCountryInfo.name}</p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>{method} · {selectedCountryInfo.currency}</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>Change</button>
          </div>

          {/* Merchant ID Input */}
          <div className="form-group">
            <label className="form-label">Merchant ID ({method})</label>
            <div className="form-input-wrapper">
              <input 
                className="form-input" 
                type="text" 
                value={merchantId} 
                onChange={(e) => setMerchantId(e.target.value)} 
                placeholder={
                  method === 'UPI' ? 'name@bank (e.g. 9876543210@ybl)' :
                  method === 'PIX' ? 'CPF, email, +Phone, or random EVP key' :
                  method === 'PayNow' ? 'Singapore number or Entity UEN' :
                  method === 'ACH' ? 'Routing-Account number format' :
                  'Merchant ID identifier'
                }
              />
            </div>
          </div>

          {/* Verified Registry Check & Feedback Card */}
          {loadingMerchant && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '20px' }}>
              <div style={{ width: '16px', height: '16px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Checking Pharos Pay registry...</span>
            </div>
          )}

          {verifiedMerchant && !loadingMerchant && (
            <div className="card" style={{ padding: '20px', border: '2px solid var(--success)', background: 'var(--success-light)', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src={verifiedMerchant.logoUrl} 
                  alt="Verified Merchant" 
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1599305445671-ec2c6c34a425?w=100&auto=format&fit=crop&q=60' }}
                  style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', background: '#fff', border: '1px solid var(--border)' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                      {verifiedMerchant.businessName}
                    </h4>
                    <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', padding: '2px 6px' }}>
                      ✓ Verified Badge
                    </span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Registered in {verifiedMerchant.country} • Payout Rail: {method}
                  </p>
                </div>
              </div>

              {/* Verification Checklist */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', borderTop: '1px solid rgba(16,185,129,0.15)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--success-dark)' }}>
                  <Ic name="check" size={14} color="var(--success)" /> Merchant Verified
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--success-dark)' }}>
                  <Ic name="check" size={14} color="var(--success)" /> Beneficiary Verified
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--success-dark)' }}>
                  <Ic name="check" size={14} color="var(--success)" /> KYC Approved
                </div>
              </div>

              {/* Settlement speed info */}
              <div style={{ background: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--success-dark)' }}>
                <span>Settlement Speed:</span>
                <strong style={{ fontWeight: 800 }}>⚡ {verifiedMerchant.settlementSpeed || 'Instant'}</strong>
              </div>
            </div>
          )}

          {/* Fallback Live Validation Panel */}
          {merchantId && !verifiedMerchant && !loadingMerchant && (
            <div className="card" style={{ padding: "14px 16px", marginBottom: "20px", background: validationResult.isValid ? "var(--success-light)" : "var(--danger-light)", borderColor: validationResult.isValid ? "#a7f3d0" : "#fca5a5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)" }}>LIVE MERCHANT CHECK</span>
                <span className={`badge ${validationResult.isValid ? 'badge-success' : 'badge-failed'}`}>
                  {validationResult.isValid ? 'Format Valid' : 'Format Invalid'}
                </span>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Country:</span> <strong style={{ color: "var(--text)" }}>{selectedCountryInfo.name}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Rail:</span> <strong style={{ color: "var(--text)" }}>{method}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Provider:</span> <strong style={{ color: "var(--text)" }}>{validationResult.provider}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Status:</span> <strong style={{ color: validationResult.isValid ? "var(--success-dark)" : "var(--danger-dark)" }}>{validationResult.text}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Merchant Display Name Input */}
          <div className="form-group">
            <label className="form-label">Merchant Name (Optional)</label>
            <div className="form-input-wrapper">
              <input 
                className="form-input" 
                type="text" 
                value={merchantName} 
                onChange={(e) => setMerchantName(e.target.value)} 
                placeholder="Enter merchant store name"
              />
            </div>
          </div>

          {/* Amount Input */}
          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label">Amount in {selectedCountryInfo.currency}</label>
            <div className="amount-input-wrapper">
              <span className="amount-symbol">{selectedCountryInfo.flag}</span>
              <input 
                className="amount-input" 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                min="0.01" 
                step="0.01" 
              />
            </div>
          </div>

          <button 
            className="btn btn-primary btn-lg" 
            style={{ width: "100%", justifyContent: "center" }}
            onClick={fetchQuote}
            disabled={loadingQuote || !merchantId || !validationResult.isValid || !amount || parseFloat(amount) <= 0 || wallet.isSwitchingNetwork}
          >
            {loadingQuote ? 'Generating Quote...' : 'Get Quote'}
            <Ic name="arrow" size={17} color="#fff" />
          </button>
        </div>
      )}

      {/* STEP 4: Payment Quote breakdown */}
      {step === 4 && quote && (
        <div className="page-enter">
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>
            Settlement Quote Breakdown
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
            Review conversions and platform fee margins.
          </p>

          <div className="card" style={{ padding: "20px", marginBottom: "16px" }}>
            {[
              ["You send", `${parseFloat(amount).toFixed(2)} ${selectedCountryInfo.currency}`, true, "var(--text)"],
              ["FX Rate", `1 USD = ${parseFloat(quote.fxRate || selectedCountryInfo.rate).toFixed(4)} ${selectedCountryInfo.currency}`, false, "var(--text-secondary)"],
              ["PROS Price", `$${parseFloat(quote.prosPrice || 0).toFixed(4)}`, false, "var(--text-secondary)"],
              ["Merchant receives", `${amount} ${selectedCountryInfo.currency}`, true, "var(--success)"],
              [`Platform Fee (${quote.feePercent}%)`, `+${quote.feeAmount} PROS`, false, "var(--warning-dark)"],
              ["Total deduction", `${quote.totalPros} PROS`, true, "var(--primary)"]
            ].map(([lbl, val, bold, col], idx) => (
              <div 
                key={lbl} 
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "12px 0", 
                  borderBottom: idx < 5 ? "1px solid var(--border-light)" : "none" 
                }}
              >
                <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{lbl}</span>
                <span style={{ fontSize: "14px", fontWeight: bold ? 800 : 600, color: col }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Live Pricing UI Details */}
          <div className="card" style={{ padding: "16px", marginBottom: "16px", background: "var(--bg-secondary)", border: "1px dashed var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>Live PROS Price</span>
                <strong style={{ color: "var(--text)", fontSize: "15px", fontWeight: 800 }}>
                  ${parseFloat(quote.prosPrice || 0).toFixed(4)}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>Source</span>
                <strong style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px", fontSize: "15px", fontWeight: 800 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)" }}></span>
                  {quote.source || "Coinbase"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>Updated</span>
                <strong style={{ color: "var(--text)", fontSize: "14px" }}>
                  {secondsSinceUpdate} {secondsSinceUpdate === 1 ? "second" : "seconds"} ago
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>FX Rate</span>
                <strong style={{ color: "var(--text)", fontSize: "14px" }}>
                  1 USD = {parseFloat(quote.fxRate || 0).toFixed(2)} {selectedCountryInfo.currency}
                </strong>
              </div>
              <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--border-light)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>Quote Refreshes In</span>
                <strong style={{ color: "var(--primary)", fontFamily: "monospace", fontSize: "16px", fontWeight: 800 }}>
                  {(() => {
                    const rem = Math.max(0, 30 - secondsSinceUpdate);
                    return `00:${rem < 10 ? '0' : ''}${rem}`;
                  })()}
                </strong>
              </div>
            </div>
          </div>

          {/* Price Staleness Warning */}
          {secondsSinceUpdate > 300 && (
            <div style={{ 
              background: "rgba(239, 68, 68, 0.1)", 
              border: "1px solid rgb(239, 68, 68)", 
              borderRadius: "10px", 
              padding: "12px 16px", 
              marginBottom: "20px"
            }}>
              <div style={{ color: "rgb(239, 68, 68)", fontWeight: 700, fontSize: "14px" }}>
                Market data unavailable.
              </div>
              <div style={{ color: "var(--text)", fontSize: "13px", marginTop: "2px" }}>
                Refresh quote before paying.
              </div>
            </div>
          )}

          <div style={{ background: "var(--primary-light)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Ic name="zap" size={16} color="var(--primary)" />
            <p style={{ fontSize: "13px", color: "var(--primary)", fontWeight: 700, margin: 0 }}>
              Estimated settlement delivery: &lt; 30 seconds via {method}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn btn-secondary" onClick={() => setStep(3)} style={{ flex: 1, justifyContent: "center" }}>
              Back
            </button>
            <button 
              className="btn btn-primary btn-lg" 
              onClick={() => setStep(5)} 
              style={{ flex: 2, justifyContent: "center" }} 
              disabled={wallet.isSwitchingNetwork || secondsSinceUpdate > 300}
            >
              Accept & Proceed
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Confirm Payment and Wallet sign-off */}
      {step === 5 && quote && (
        <div className="page-enter">
          <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", marginBottom: "4px" }}>
            Verify & Confirm
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
            Sign the wallet approval and payment transaction.
          </p>

          <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
            {[
              ["Recipient", `${selectedCountryInfo.flag} ${merchantName || 'Merchant Store'} (${method})`],
              ["Merchant Identifier", merchantId],
              ["Local Amount", `${parseFloat(amount).toFixed(2)} ${selectedCountryInfo.currency}`],
              [`PROS Exchange Cost`, `${quote.merchantPros} PROS`],
              ["Platform Fee", `${quote.feeAmount} PROS`],
              ["Total Charge", `${quote.totalPros} PROS`],
              ...(verifiedMerchant ? [
                ["Registry Trust", (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 5px' }}>✓ Merchant</span>
                    <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 5px' }}>✓ Beneficiary</span>
                    <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 5px' }}>✓ KYC</span>
                  </div>
                )]
              ] : [])
            ].map(([lbl, val], idx, arr) => (
              <div 
                key={idx} 
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  padding: "10px 0", 
                  borderBottom: idx < arr.length - 1 ? "1px solid var(--border-light)" : "none",
                  fontSize: "13px"
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{lbl}</span>
                <span style={{ fontWeight: 700, color: "var(--text)" }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Live Pricing UI Details */}
          <div className="card" style={{ padding: "16px", marginBottom: "20px", background: "var(--bg-secondary)", border: "1px dashed var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>Live PROS Price</span>
                <strong style={{ color: "var(--text)", fontSize: "15px", fontWeight: 800 }}>
                  ${parseFloat(quote.prosPrice || 0).toFixed(4)}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>Source</span>
                <strong style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "4px", fontSize: "15px", fontWeight: 800 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)" }}></span>
                  {quote.source || "Coinbase"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>Updated</span>
                <strong style={{ color: "var(--text)", fontSize: "14px" }}>
                  {secondsSinceUpdate} {secondsSinceUpdate === 1 ? "second" : "seconds"} ago
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", marginBottom: "2px", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>FX Rate</span>
                <strong style={{ color: "var(--text)", fontSize: "14px" }}>
                  1 USD = {parseFloat(quote.fxRate || 0).toFixed(2)} {selectedCountryInfo.currency}
                </strong>
              </div>
              <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--border-light)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600 }}>Quote Refreshes In</span>
                <strong style={{ color: "var(--primary)", fontFamily: "monospace", fontSize: "16px", fontWeight: 800 }}>
                  {(() => {
                    const rem = Math.max(0, 30 - secondsSinceUpdate);
                    return `00:${rem < 10 ? '0' : ''}${rem}`;
                  })()}
                </strong>
              </div>
            </div>
          </div>

          {/* Price Staleness Warning */}
          {secondsSinceUpdate > 300 && (
            <div style={{ 
              background: "rgba(239, 68, 68, 0.1)", 
              border: "1px solid rgb(239, 68, 68)", 
              borderRadius: "10px", 
              padding: "12px 16px", 
              marginBottom: "20px"
            }}>
              <div style={{ color: "rgb(239, 68, 68)", fontWeight: 700, fontSize: "14px" }}>
                Market data unavailable.
              </div>
              <div style={{ color: "var(--text)", fontSize: "13px", marginTop: "2px" }}>
                Refresh quote before paying.
              </div>
            </div>
          )}

          <div style={{ background: "var(--warning-light)", border: "1px solid #fcd34d", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px" }}>
            <p style={{ fontSize: "13px", color: "var(--warning-dark)", fontWeight: 600, margin: 0 }}>
              ⚠️ Transactions are irreversible. Ensure validation checks pass before signing MetaMask payouts.
            </p>
          </div>

          {/* Action trigger & states */}
          {paymentStatus === 'idle' && (
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="btn btn-secondary" onClick={() => setStep(4)} style={{ flex: 1, justifyContent: "center" }}>
                Back
              </button>
              <button 
                className="btn btn-primary btn-lg" 
                onClick={executePayment} 
                style={{ flex: 2, justifyContent: "center" }}
                disabled={wallet.isSwitchingNetwork || secondsSinceUpdate > 300}
              >
                <Ic name="check" size={17} color="#fff" /> Confirm & Pay
              </button>
            </div>
          )}

          {paymentStatus === 'approving' && (
            <div className="card" style={{ padding: "24px", textAlign: "center" }}>
              <div style={{ width: "28px", height: "28px", border: "2.5px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 700, fontSize: "14px" }}>Approving PROS Allowance</p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Please sign the spend limit approval in MetaMask...</p>
            </div>
          )}

          {paymentStatus === 'paying' && (
            <div className="card" style={{ padding: "24px", textAlign: "center" }}>
              <div style={{ width: "28px", height: "28px", border: "2.5px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 700, fontSize: "14px" }}>Executing Payment on Pharos</p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Please confirm the transaction in your wallet...</p>
            </div>
          )}

          {paymentStatus === 'confirming' && (
            <div className="card" style={{ padding: "24px", textAlign: "center" }}>
              <div style={{ width: "28px", height: "28px", border: "2.5px solid var(--warning)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 700, fontSize: "14px", color: "var(--warning-dark)" }}>Waiting for block confirmation</p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>Securing transaction on Pharos Atlantic network...</p>
            </div>
          )}

          {paymentStatus === 'failed' && (
            <div className="card" style={{ padding: "24px", textAlign: "center" }}>
              <p style={{ fontWeight: 700, color: "var(--danger-dark)", fontSize: "15px" }}>Transaction Reverted</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setPaymentStatus('idle')} style={{ margin: "12px auto 0" }}>
                Retry Transaction
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 6: Success Receipt Invoice */}
      {step === 6 && txResult && (
        <ReceiptViewer
          payment={txResult}
          onClose={handleReset}
        />
      )}

      {/* Recent Merchants helper panel */}
      {step < 3 && recentMerchants.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <h4 style={{ fontSize: "13px", fontWeight: 800, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
            Recent Merchants
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentMerchants.map(m => {
              const cInfo = COUNTRIES.find(c => c.id === m.country) || COUNTRIES[0];
              return (
                <div 
                  className="card interactive" 
                  key={m.id}
                  onClick={() => {
                    setCountry(m.country);
                    setMethod(m.rail);
                    setMerchantId(m.id);
                    setMerchantName(m.name);
                    setStep(3);
                  }}
                  style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>{cInfo.flag}</span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", margin: 0 }}>{m.name}</p>
                      <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>{m.id}</p>
                    </div>
                  </div>
                  <span className="badge" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {m.rail}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
