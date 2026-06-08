import React, { useState, useEffect } from 'react';
import { API_BASE, CURRENCIES } from '../config';
import { Ic } from '../components/Icons';

// Phase 2 Support V2 Imports
import AIAnalysisCard from '../components/admin/AIAnalysisCard';
import EscalationTimeline from '../components/admin/EscalationTimeline';
import TicketAssignModal from '../components/admin/TicketAssignModal';
import ConversationExport from '../components/admin/ConversationExport';
import HandoffPanel from '../components/admin/HandoffPanel';
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard';

export default function MerchantDashboard({ wallet }) {
  const [merchantId, setMerchantId] = useState(localStorage.getItem('pharos_merchant_id') || '');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Onboarding Wizard steps: 1: Info, 2: KYC, 3: Beneficiary payout account link, 4: Finished
  const [onboardStep, setOnboardStep] = useState(1);
  const [newMerchantId, setNewMerchantId] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newCountry, setNewCountry] = useState('IN');
  const [newRails, setNewRails] = useState(['UPI']);
  const [newUpiId, setNewUpiId] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');
  const [newIfsc, setNewIfsc] = useState('');
  const [newPixKey, setNewPixKey] = useState('');
  const [newPayNowId, setNewPayNowId] = useState('');
  const [newAchAccount, setNewAchAccount] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newSpeed, setNewSpeed] = useState('Instant');
  const [kycProgress, setKycProgress] = useState(0);

  // Active dashboard states
  const [activeTab, setActiveTab] = useState('settlements'); // 'settlements' | 'payout' | 'qr' | 'team' | 'support'
  const [settlements, setSettlements] = useState([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);

  // Support Tickets states
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportStats, setSupportStats] = useState(null);
  const [loadingSupportTickets, setLoadingSupportTickets] = useState(false);
  const [supportStatusFilter, setSupportStatusFilter] = useState('all');
  
  // Support V2 States
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  
  // Team Management states
  const [newTeamEmail, setNewTeamEmail] = useState('');
  const [teamError, setTeamError] = useState(null);

  // QR Code generator states
  const [qrRail, setQrRail] = useState('UPI');
  const [qrAmount, setQrAmount] = useState('');
  const [generatedPayload, setGeneratedPayload] = useState('');
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Profile Edit states
  const [editUpiId, setEditUpiId] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editIfsc, setEditIfsc] = useState('');
  const [editPixKey, setEditPixKey] = useState('');
  const [editPayNowId, setEditPayNowId] = useState('');
  const [editAchAccount, setEditAchAccount] = useState('');
  const [isUpdatingPayout, setIsUpdatingPayout] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  // Load profile on mount or when merchantId changes
  useEffect(() => {
    if (merchantId) {
      fetchProfile(merchantId);
    }
  }, [merchantId]);

  // Load settlements / support when tab changes or profile is updated
  useEffect(() => {
    if (profile && activeTab === 'settlements') {
      fetchSettlements(profile.merchantId);
    }
    if (profile && activeTab === 'support') {
      fetchSupportTickets();
    }
  }, [profile, activeTab]);

  const fetchProfile = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/merchants/${id}`);
      const data = await res.json();
      if (data.success) {
        setProfile(data.merchant);
        // Sync editing states
        setEditUpiId(data.merchant.upiId || '');
        setEditBankAccount(data.merchant.bankAccountMasked || '');
        setEditIfsc(data.merchant.ifscMasked || '');
        setEditPixKey(data.merchant.pixKey || '');
        setEditPayNowId(data.merchant.payNowId || '');
        setEditAchAccount(data.merchant.achAccountMasked || '');
        
        // Auto setup default QR generator payload based on this merchant
        const payload = {
          merchantId: data.merchant.merchantId,
          country: data.merchant.country,
          rail: data.merchant.supportedRails?.[0] || 'UPI',
          merchantName: data.merchant.businessName,
          beneficiaryId: data.merchant.beneficiaryId
        };
        setQrRail(data.merchant.supportedRails?.[0] || 'UPI');
        setGeneratedPayload(JSON.stringify(payload));
      } else {
        setError(data.error || 'Failed to load merchant profile');
        setProfile(null);
      }
    } catch (err) {
      setError('Connection to backend failed');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettlements = async (id) => {
    setLoadingSettlements(true);
    try {
      const res = await fetch(`${API_BASE}/merchants/${id}/settlements`);
      const data = await res.json();
      if (data.success) {
        setSettlements(data.settlements);
      }
    } catch (err) {
      console.warn('Failed to load settlements:', err);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const fetchSupportTickets = async () => {
    setLoadingSupportTickets(true);
    try {
      const [ticketsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/support/tickets`),
        fetch(`${API_BASE}/support/stats`),
      ]);
      const ticketsData = await ticketsRes.json();
      const statsData = await statsRes.json();
      if (ticketsData.success) setSupportTickets(ticketsData.tickets);
      if (statsData.success) setSupportStats(statsData.stats);
    } catch (err) {
      console.warn('Failed to load support data:', err);
    } finally {
      setLoadingSupportTickets(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, resolution: newStatus === 'resolved' ? 'Resolved by merchant admin.' : undefined }),
      });
      const data = await res.json();
      if (data.success) fetchSupportTickets();
    } catch (err) {
      alert('Failed to update ticket status');
    }
  };

  // Submit profile details (Step 1 -> 2)
  const handleOnboardingSignup = (e) => {
    e.preventDefault();
    if (!newMerchantId || !newBusinessName) {
      alert('Please fill out required fields');
      return;
    }
    // Lock values and start simulated KYC
    setOnboardStep(2);
    setKycProgress(0);
  };

  // Run simulated KYC animation (Step 2 -> 3)
  useEffect(() => {
    if (onboardStep === 2) {
      const interval = setInterval(() => {
        setKycProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setOnboardStep(3);
            }, 600);
            return 100;
          }
          return prev + 10;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [onboardStep]);

  // Submit beneficiary / link payout accounts (Step 3 -> Finished)
  const handleOnboardingBeneficiary = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        merchantId: newMerchantId,
        businessName: newBusinessName,
        country: newCountry,
        supportedRails: newRails,
        upiId: newUpiId,
        bankAccountMasked: newBankAccount ? `••••••••${newBankAccount.slice(-4)}` : '',
        ifscMasked: newIfsc ? `${newIfsc.slice(0, 4)}••••${newIfsc.slice(-3)}` : '',
        pixKey: newPixKey,
        payNowId: newPayNowId,
        achAccountMasked: newAchAccount ? `••••••••${newAchAccount.slice(-4)}` : '',
        logoUrl: newLogoUrl,
        settlementSpeed: newSpeed,
      };

      const res = await fetch(`${API_BASE}/merchants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('pharos_merchant_id', newMerchantId);
        setMerchantId(newMerchantId);
        setOnboardStep(4);
      } else {
        alert(data.error || 'Failed to submit profile registration');
      }
    } catch (err) {
      alert('Network error registering merchant');
    } finally {
      setLoading(false);
    }
  };

  // Add team member
  const handleAddTeamMember = async (e) => {
    e.preventDefault();
    if (!newTeamEmail) return;
    setTeamError(null);
    try {
      const res = await fetch(`${API_BASE}/merchants/${profile.merchantId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newTeamEmail })
      });
      const data = await res.json();
      if (data.success) {
        setProfile({ ...profile, teamMembers: data.teamMembers });
        setNewTeamEmail('');
      } else {
        setTeamError(data.error);
      }
    } catch (err) {
      setTeamError('Failed to invite team member');
    }
  };

  // Remove team member
  const handleRemoveTeamMember = async (email) => {
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/merchants/${profile.merchantId}/team/${email}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setProfile({ ...profile, teamMembers: data.teamMembers });
      }
    } catch (err) {
      alert('Failed to remove team member');
    }
  };

  // Update Payout settings
  const handleUpdatePayout = async (e) => {
    e.preventDefault();
    setIsUpdatingPayout(true);
    setPayoutSuccess(false);
    try {
      const updatedFields = {
        upiId: editUpiId,
        bankAccountMasked: editBankAccount.startsWith('••') ? editBankAccount : `••••••••${editBankAccount.slice(-4)}`,
        ifscMasked: editIfsc.includes('••') ? editIfsc : `${editIfsc.slice(0, 4)}••••${editIfsc.slice(-3)}`,
        pixKey: editPixKey,
        payNowId: editPayNowId,
        achAccountMasked: editAchAccount.startsWith('••') ? editAchAccount : `••••••••${editAchAccount.slice(-4)}`,
      };

      const res = await fetch(`${API_BASE}/merchants/${profile.merchantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.merchant);
        setPayoutSuccess(true);
        setTimeout(() => setPayoutSuccess(false), 3000);
      } else {
        alert(data.error || 'Failed to update payouts');
      }
    } catch (err) {
      alert('Network failure updating payouts');
    } finally {
      setIsUpdatingPayout(false);
    }
  };

  // Generate QR payload when settings change
  const handleGenerateQR = (e) => {
    e.preventDefault();
    const payload = {
      merchantId: profile.merchantId,
      country: profile.country,
      rail: qrRail,
      merchantName: profile.businessName,
      beneficiaryId: profile.beneficiaryId
    };
    if (qrAmount) {
      payload.amount = parseFloat(qrAmount);
    }
    setGeneratedPayload(JSON.stringify(payload));
  };

  // Copy QR JSON payload
  const copyQRPayload = () => {
    navigator.clipboard.writeText(generatedPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // CSV export
  const exportCSV = () => {
    if (settlements.length === 0) return;
    const headers = ['Settlement ID', 'Tx Hash', 'Date', 'Amount', 'Currency', 'Rail', 'UTR', 'Status'];
    const rows = settlements.map(s => [
      s.settlementId,
      s.txHash,
      new Date(s.simulatedAt).toLocaleString(),
      s.amount,
      s.currency,
      s.paymentRail,
      s.utr,
      s.status
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.map(field => `"${field}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `settlements_${profile.merchantId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print single settlement receipt
  const printReceipt = (settlement) => {
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
              <h3>PharosPay Settlement Voucher</h3>
              <p style="font-size:12px;color:#64748b;">Instant Fiat Merchant Payout</p>
            </div>
            <div class="row"><span>Merchant Business</span><strong>${profile.businessName}</strong></div>
            <div class="row"><span>Merchant ID</span><strong>${profile.merchantId}</strong></div>
            <div class="row"><span>Beneficiary ID</span><strong>${profile.beneficiaryId}</strong></div>
            <div class="row"><span>Payment Rail</span><strong>${settlement.paymentRail}</strong></div>
            <div class="row"><span>Amount Settled</span><strong>${settlement.amount} ${settlement.currency}</strong></div>
            <div class="row"><span>UTR Number</span><strong>${settlement.utr}</strong></div>
            <div class="row"><span>Date Settled</span><strong>${new Date(settlement.simulatedAt).toLocaleString()}</strong></div>
            <div class="row"><span>Status</span><strong>${settlement.status} / COMPLETED</strong></div>
            <div style="margin-top:14px;padding-top:14px;border-top:2px solid #e2e8f0;font-size:10px;color:#64748b;font-family:monospace;word-break:break-all;">
              TxHash: ${settlement.txHash}
            </div>
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

  const resetMerchantState = () => {
    if (window.confirm('Reset merchant profile state for demo testing?')) {
      localStorage.removeItem('pharos_merchant_id');
      setMerchantId('');
      setProfile(null);
      setOnboardStep(1);
    }
  };

  // --- RENDERS ---

  // Loading indicator
  if (loading && !profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Loading Merchant OS...</p>
      </div>
    );
  }

  // ONBOARDING FLOW
  if (!profile) {
    return (
      <div className="page-enter" style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Ic name="zap" size={24} color="#fff" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Merchant Registration</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Activate your PharosPay Merchant OS to receive instant global payouts.
          </p>
        </div>

        {/* Wizard Steps indicator bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
          {[
            { step: 1, label: 'Merchant Profile' },
            { step: 2, label: 'KYC Verification' },
            { step: 3, label: 'Payout Account' },
            { step: 4, label: 'Ready' }
          ].map((item, idx) => (
            <React.Fragment key={item.step}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: onboardStep > item.step ? 'var(--success)' : onboardStep === item.step ? 'var(--primary)' : 'var(--bg-tertiary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800
                }}>
                  {onboardStep > item.step ? <Ic name="check" size={14} color="#fff" /> : item.step}
                </div>
                <span style={{ fontSize: '11px', fontWeight: onboardStep === item.step ? 800 : 500, color: onboardStep === item.step ? 'var(--primary)' : 'var(--text-secondary)', marginTop: '6px' }}>
                  {item.label}
                </span>
              </div>
              {idx < 3 && (
                <div style={{ height: '2px', background: onboardStep > item.step ? 'var(--success)' : 'var(--border)', flex: 1, marginBottom: '16px' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Onboard Step 1: Profile details */}
        {onboardStep === 1 && (
          <form onSubmit={handleOnboardingSignup} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '15px' }}>Business Credentials</span>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setNewMerchantId('MERCHANT_001');
                  setNewBusinessName('India Post Payment Bank');
                  setNewCountry('IN');
                  setNewRails(['UPI', 'Bank Transfer']);
                  setNewSpeed('Instant');
                  setNewLogoUrl('https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=100&auto=format&fit=crop&q=60');
                }}
              >
                Auto-Fill Seed (Post Bank)
              </button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Unique Merchant ID</label>
              <div className="form-input-wrapper">
                <input 
                  type="text" 
                  className="form-input" 
                  value={newMerchantId} 
                  onChange={(e) => setNewMerchantId(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  placeholder="e.g. INDIA_POST_PAY"
                  required
                />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Used in your QR Payload. Avoid special characters except underscores.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Registered Business Name</label>
              <div className="form-input-wrapper">
                <input 
                  type="text" 
                  className="form-input" 
                  value={newBusinessName} 
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="e.g. India Post Payment Bank Ltd"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Settlement Country</label>
                <div className="form-input-wrapper">
                  <select className="form-input" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} style={{ background: 'transparent', border: 'none' }}>
                    <option value="IN">🇮🇳 India</option>
                    <option value="BR">🇧🇷 Brazil</option>
                    <option value="SG">🇸🇬 Singapore</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="TH">🇹🇭 Thailand</option>
                    <option value="ID">🇮🇩 Indonesia</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payout Rail</label>
                <div className="form-input-wrapper">
                  <select 
                    className="form-input" 
                    value={newRails[0]} 
                    onChange={(e) => setNewRails([e.target.value])}
                    style={{ background: 'transparent', border: 'none' }}
                  >
                    <option value="UPI">UPI (India)</option>
                    <option value="Bank Transfer">Bank Transfer (IMPS/ACH/SEPA)</option>
                    <option value="PIX">PIX (Brazil)</option>
                    <option value="PayNow">PayNow (Singapore)</option>
                    <option value="PromptPay">PromptPay (Thailand)</option>
                    <option value="QRIS">QRIS (Indonesia)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Logo / Brand Image URL (Optional)</label>
              <div className="form-input-wrapper">
                <input 
                  type="url" 
                  className="form-input" 
                  value={newLogoUrl} 
                  onChange={(e) => setNewLogoUrl(e.target.value)}
                  placeholder="e.g. https://domain.com/logo.png"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              Proceed to Verification
            </button>
          </form>
        )}

        {/* Onboard Step 2: Simulated KYC */}
        {onboardStep === 2 && (
          <div className="card" style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', height: '100%', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1.5s linear infinite', position: 'absolute' }} />
              <Ic name="shield" size={32} color="var(--primary)" />
            </div>

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>KYC Identity Verification</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Querying global databases for legal compliance registers...
              </p>
            </div>

            <div style={{ width: '100%', background: 'var(--bg-secondary)', height: '8px', borderRadius: '4px', overflow: 'hidden', maxWidth: '300px' }}>
              <div style={{ background: 'var(--primary)', width: `${kycProgress}%`, height: '100%', transition: 'width 0.15s ease-out' }} />
            </div>
            
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>{kycProgress}% Complete</span>
          </div>
        )}

        {/* Onboard Step 3: Payout bank details */}
        {onboardStep === 3 && (
          <form onSubmit={handleOnboardingBeneficiary} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Link Settlement Beneficiary Account</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Provide the payout account corresponding to your selected rail method ({newRails.join(' / ')}).
              </p>
            </div>

            {newRails.includes('UPI') && (
              <div className="form-group">
                <label className="form-label">Beneficiary UPI ID</label>
                <div className="form-input-wrapper">
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newUpiId} 
                    onChange={(e) => setNewUpiId(e.target.value)} 
                    placeholder="e.g. business@okaxis"
                    required
                  />
                </div>
              </div>
            )}

            {newRails.includes('PIX') && (
              <div className="form-group">
                <label className="form-label">Beneficiary PIX Key</label>
                <div className="form-input-wrapper">
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newPixKey} 
                    onChange={(e) => setNewPixKey(e.target.value)} 
                    placeholder="EVP key, Email, or Tax ID"
                    required
                  />
                </div>
              </div>
            )}

            {newRails.includes('PayNow') && (
              <div className="form-group">
                <label className="form-label">Beneficiary PayNow ID (UEN / Mobile)</label>
                <div className="form-input-wrapper">
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newPayNowId} 
                    onChange={(e) => setNewPayNowId(e.target.value)} 
                    placeholder="Enter Entity UEN or registered Mobile"
                    required
                  />
                </div>
              </div>
            )}

            {/* General bank payout details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Bank Account Number</label>
                <div className="form-input-wrapper">
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newBankAccount} 
                    onChange={(e) => setNewBankAccount(e.target.value)} 
                    placeholder="Account Number"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">IFSC / Routing / Swift Code</label>
                <div className="form-input-wrapper">
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newIfsc} 
                    onChange={(e) => setNewIfsc(e.target.value)} 
                    placeholder="e.g. SBIN0001234"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Settlement Speed Speed</label>
              <div className="form-input-wrapper">
                <select className="form-input" value={newSpeed} onChange={(e) => setNewSpeed(e.target.value)} style={{ background: 'transparent', border: 'none' }}>
                  <option value="Instant">⚡ Instant Settlement (&lt; 30 seconds)</option>
                  <option value="2 Hours">🕒 2 Hours Speed</option>
                  <option value="Same-Day">📅 Same-Day Payout</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} disabled={loading}>
              {loading ? 'Creating Profile...' : 'Complete Beneficiary Registration'}
            </button>
          </form>
        )}
      </div>
    );
  }

  // MAIN DASHBOARD OPERATING SYSTEM
  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1024px', margin: '0 auto' }}>
      
      {/* Profile Header section */}
      <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img 
              src={profile.logoUrl} 
              alt="Logo" 
              onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1599305445671-ec2c6c34a425?w=100&auto=format&fit=crop&q=60' }} 
              style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{profile.businessName}</h2>
                <span className="badge badge-success" style={{ padding: '3px 8px', fontSize: '10px' }}>
                  <Ic name="check" size={10} color="var(--success-dark)" /> Verified Merchant
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>ID: {profile.merchantId}</span> • <span>Beneficiary: {profile.beneficiaryId}</span>
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchProfile(profile.merchantId)}>
              <Ic name="refresh" size={14} color="var(--text-secondary)" /> Refresh
            </button>
            <button className="btn btn-ghost btn-sm" onClick={resetMerchantState} style={{ color: 'var(--danger-dark)' }}>
              Reset Profile
            </button>
          </div>
        </div>

        {/* Verification Badges Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--success-dark)' }}>
            <Ic name="check" size={16} color="var(--success)" /> Merchant Verified
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--success-dark)' }}>
            <Ic name="check" size={16} color="var(--success)" /> Beneficiary Verified
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--success-dark)' }}>
            <Ic name="check" size={16} color="var(--success)" /> KYC Approved
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
            ⚡ Payout: {profile.settlementSpeed}
          </div>
        </div>
      </div>

      {/* Main Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Total Payouts</span>
          <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', margin: '8px 0 2px 0' }}>{settlements.length}</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Cross-border settlements delivered</p>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Volume Settle</span>
          <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', margin: '8px 0 2px 0' }}>
            {settlements.length > 0 ? settlements.reduce((sum, s) => sum + s.amount, 0).toFixed(2) : '0.00'} {settlements[0]?.currency || 'INR'}
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Gross local fiat liquidity processed</p>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Payout Account</span>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', margin: '14px 0 2px 0', wordBreak: 'break-all' }}>
            {profile.upiId || profile.bankAccountMasked || 'No payout accounts configured'}
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Target Destination Rail: {profile.supportedRails?.join(' / ')}</p>
        </div>
      </div>

      {/* Tab Navigation Section */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '16px', marginBottom: '20px' }}>
        {[
          { id: 'settlements', label: 'Settlements & UTRs', icon: 'history' },
          { id: 'payout', label: 'Payout Account Profile', icon: 'wallet' },
          { id: 'qr', label: 'Generate QR Code', icon: 'qr' },
          { id: 'team', label: 'Team Members', icon: 'globe' },
          { id: 'support', label: 'Support Tickets', icon: 'ticket' },
          { id: 'analytics', label: 'Support Analytics', icon: 'chart' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 4px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 800 : 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)'
            }}
          >
            <Ic name={tab.icon} size={15} color={activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Display */}
      <div className="page-enter">
        
        {/* TAB 1: settlements logs */}
        {activeTab === 'settlements' && (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Settlement Records</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Payout logs containing standard central banking UTR tracking registers.
                </p>
              </div>
              
              {settlements.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
                  <Ic name="dl" size={14} color="var(--text-secondary)" /> Export Payouts CSV
                </button>
              )}
            </div>

            {loadingSettlements ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ width: '24px', height: '24px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Fetching transaction ledgers...</p>
              </div>
            ) : settlements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                <Ic name="alert" size={24} color="var(--text-tertiary)" style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>No settlements received yet</p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Payments sent to your merchant ID will populate here in real-time.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px 8px' }}>Date</th>
                      <th style={{ padding: '12px 8px' }}>UTR / Reference</th>
                      <th style={{ padding: '12px 8px' }}>Amount Settle</th>
                      <th style={{ padding: '12px 8px' }}>Rail Method</th>
                      <th style={{ padding: '12px 8px' }}>Status</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((s) => (
                      <tr key={s.settlementId} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>
                          {new Date(s.simulatedAt).toLocaleDateString()}
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)' }}>
                            {new Date(s.simulatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{s.utr}</span>
                          <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            Tx: {s.txHash.substring(0, 14)}...
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--success-dark)' }}>
                          {s.amount.toFixed(2)} {s.currency}
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{s.paymentRail}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>{s.status}</span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => printReceipt(s)}>
                            Voucher Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Payout Accounts Edit */}
        {activeTab === 'payout' && (
          <form onSubmit={handleUpdatePayout} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Update Payout Profiles</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Keep your destination central bank or wire details synchronized.
              </p>
            </div>

            {payoutSuccess && (
              <div style={{ background: 'var(--success-light)', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ic name="check" size={16} color="var(--success)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success-dark)' }}>Payout profile successfully updated!</span>
              </div>
            )}

            {profile.supportedRails.includes('UPI') && (
              <div className="form-group">
                <label className="form-label">Beneficiary UPI ID</label>
                <div className="form-input-wrapper">
                  <input type="text" className="form-input" value={editUpiId} onChange={(e) => setEditUpiId(e.target.value)} placeholder="e.g. merchant@upi" />
                </div>
              </div>
            )}

            {profile.supportedRails.includes('PIX') && (
              <div className="form-group">
                <label className="form-label">Beneficiary PIX Key</label>
                <div className="form-input-wrapper">
                  <input type="text" className="form-input" value={editPixKey} onChange={(e) => setEditPixKey(e.target.value)} />
                </div>
              </div>
            )}

            {profile.supportedRails.includes('PayNow') && (
              <div className="form-group">
                <label className="form-label">PayNow Target ID (UEN / Mobile)</label>
                <div className="form-input-wrapper">
                  <input type="text" className="form-input" value={editPayNowId} onChange={(e) => setEditPayNowId(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Bank Account Number (Masked / Clear)</label>
                <div className="form-input-wrapper">
                  <input type="text" className="form-input" value={editBankAccount} onChange={(e) => setEditBankAccount(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">IFSC / routing Code (Masked / Clear)</label>
                <div className="form-input-wrapper">
                  <input type="text" className="form-input" value={editIfsc} onChange={(e) => setEditIfsc(e.target.value)} />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 20px', minWidth: '150px' }} disabled={isUpdatingPayout}>
              {isUpdatingPayout ? 'Saving Payouts...' : 'Save Changes'}
            </button>
          </form>
        )}

        {/* TAB 3: QR Generator */}
        {activeTab === 'qr' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Generator Form */}
            <form onSubmit={handleGenerateQR} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Configure QR Payload</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Generate clean payload QR codes for customers to auto-fetch business profiles.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Rail</label>
                <div className="form-input-wrapper">
                  <select className="form-input" value={qrRail} onChange={(e) => setQrRail(e.target.value)} style={{ background: 'transparent', border: 'none' }}>
                    {profile.supportedRails.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Pre-Set Amount (Optional)</label>
                <div className="form-input-wrapper">
                  <input 
                    type="number" 
                    className="form-input" 
                    value={qrAmount} 
                    onChange={(e) => setQrAmount(e.target.value)} 
                    placeholder="Enter fixed checkout amount" 
                    min="0"
                    step="0.01"
                  />
                </div>
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Leave blank if customer inputs custom checkout amount.
                </p>
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Refresh Payload QR
              </button>
            </form>

            {/* QR Result Box */}
            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>QR Code Graphic</span>
              
              {/* Actual working QR code generated via public helper server */}
              <div style={{ padding: '12px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(generatedPayload)}`} 
                  alt="Merchant QR" 
                  style={{ width: '160px', height: '160px', display: 'block' }}
                />
              </div>

              <div style={{ width: '100%' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', textAlign: 'left', marginBottom: '6px' }}>
                  QR Payload (Copy to test paste/scan):
                </span>
                
                <code style={{ display: 'block', textWrap: 'wrap', wordBreak: 'break-all', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 10px', fontFamily: 'monospace', textAlign: 'left' }}>
                  {generatedPayload}
                </code>

                <button className="btn btn-secondary btn-sm" onClick={copyQRPayload} style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}>
                  <Ic name="copy" size={13} color="var(--text-secondary)" /> {copiedPayload ? 'Copied to Clipboard!' : 'Copy QR JSON Payload'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Team invites */}
        {activeTab === 'team' && (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Manage Team Members</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Authorize staff to view settlements, download invoicing summaries, and manage QR setups.
              </p>
            </div>

            {/* Invite Form */}
            <form onSubmit={handleAddTeamMember} style={{ display: 'flex', gap: '10px', marginBottom: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '220px' }}>
                <label className="form-label">Add Member Email</label>
                <div className="form-input-wrapper">
                  <input 
                    type="email" 
                    className="form-input" 
                    value={newTeamEmail} 
                    onChange={(e) => setNewTeamEmail(e.target.value)} 
                    placeholder="staff@company.com" 
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '12px 20px' }}>
                Invite Member
              </button>
            </form>

            {teamError && (
              <p style={{ color: 'var(--danger-dark)', fontSize: '12px', fontWeight: 600, marginTop: '-12px', marginBottom: '16px' }}>
                ⚠️ {teamError}
              </p>
            )}

            {/* Team List */}
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              Authorized Members ({profile.teamMembers?.length || 0})
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profile.teamMembers?.map((email) => (
                <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 800, fontSize: '12px' }}>
                      {email[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{email}</span>
                  </div>

                  <button 
                    className="btn btn-ghost btn-sm" 
                    onClick={() => handleRemoveTeamMember(email)}
                    style={{ color: 'var(--danger-dark)', padding: '4px 8px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: Support Tickets (Admin View) */}
        {activeTab === 'support' && (
          <div>
            {selectedTicketId ? (() => {
              const ticket = supportTickets.find(t => t.id === selectedTicketId);
              if (!ticket) return null;
              return (
                <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button 
                      onClick={() => setSelectedTicketId(null)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>←</span> Back to Tickets
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <ConversationExport ticket={ticket} messages={[]} />
                      <button
                        onClick={() => setAssignModalOpen(true)}
                        style={{
                          background: 'var(--primary, #6366f1)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Assign Agent
                      </button>
                    </div>
                  </div>

                  {/* Split Layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
                    {/* Left Pane: Details & takeover panels */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 800 }}>{ticket.subject}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
                      </div>
                      <HandoffPanel ticketId={ticket.id} onStatusChange={() => {}} />
                    </div>

                    {/* Right Pane: AI Report Card & timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <AIAnalysisCard ticketId={ticket.id} />
                      <EscalationTimeline ticketId={ticket.id} />
                    </div>
                  </div>

                  <TicketAssignModal 
                    isOpen={assignModalOpen} 
                    onClose={() => setAssignModalOpen(false)} 
                    ticketId={ticket.id} 
                    currentAgentId={ticket.assignedMerchantId}
                    onAssigned={(updated) => {
                      setSupportTickets(prev => prev.map(t => t.id === updated.id ? { ...t, assignedMerchantId: updated.assigned_merchant_id } : t));
                    }}
                  />
                </div>
              );
            })() : (
              <div>
            {/* Support Stats Row */}
            {supportStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Open</span>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', margin: '6px 0 0 0' }}>{supportStats.open}</h3>
                </div>
                <div className="card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>In Progress</span>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#d97706', margin: '6px 0 0 0' }}>{supportStats.inProgress}</h3>
                </div>
                <div className="card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Resolved Today</span>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)', margin: '6px 0 0 0' }}>{supportStats.resolvedToday}</h3>
                </div>
                <div className="card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Resolution</span>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', margin: '6px 0 0 0' }}>{supportStats.avgResolutionHours ? `${supportStats.avgResolutionHours}h` : 'N/A'}</h3>
                </div>
              </div>
            )}

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
                <button
                  key={s}
                  onClick={() => setSupportStatusFilter(s)}
                  className={`btn btn-sm ${supportStatusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', textTransform: 'capitalize' }}
                >
                  {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>All Tickets</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Manage and triage customer support requests</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchSupportTickets}>
                  <Ic name="refresh" size={13} /> Refresh
                </button>
              </div>

              {loadingSupportTickets ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div style={{ width: '24px', height: '24px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Loading tickets...</p>
                </div>
              ) : (() => {
                const filtered = supportTickets.filter(t => supportStatusFilter === 'all' || t.status === supportStatusFilter);
                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 10px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                      <Ic name="ticket" size={24} color="var(--text-tertiary)" />
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', margin: '8px 0 0' }}>No support tickets found</p>
                    </div>
                  );
                }
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '10px 8px' }}>Ticket</th>
                          <th style={{ padding: '10px 8px' }}>Subject</th>
                          <th style={{ padding: '10px 8px' }}>Category</th>
                          <th style={{ padding: '10px 8px' }}>Priority</th>
                          <th style={{ padding: '10px 8px' }}>Status</th>
                          <th style={{ padding: '10px 8px' }}>Created</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(t => {
                          const statusStyles = {
                            open: { bg: 'var(--primary-light)', color: 'var(--primary)' },
                            in_progress: { bg: '#fef3c7', color: '#d97706' },
                            resolved: { bg: '#d1fae5', color: '#059669' },
                            closed: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' },
                          };
                          const priorityColors = { low: '#64748b', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' };
                          const st = statusStyles[t.status] || statusStyles.open;
                          return (
                            <tr 
                              key={t.id} 
                              onClick={() => setSelectedTicketId(t.id)}
                              style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary)', fontSize: '11px' }}>{t.ticketNumber}</td>
                              <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{(t.category || 'general').replace('_', ' ')}</td>
                              <td style={{ padding: '10px 8px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: priorityColors[t.priority] || '#64748b', fontWeight: 700 }}>
                                  <Ic name="flag" size={11} color={priorityColors[t.priority] || '#64748b'} />
                                  {(t.priority || 'medium').charAt(0).toUpperCase() + (t.priority || 'medium').slice(1)}
                                </span>
                              </td>
                              <td style={{ padding: '10px 8px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: st.bg, color: st.color }}>
                                  {t.status === 'in_progress' ? 'In Progress' : (t.status || 'open').charAt(0).toUpperCase() + (t.status || 'open').slice(1)}
                                </span>
                              </td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  {t.status === 'open' && (
                                    <button className="btn btn-secondary btn-sm" style={{ fontSize: '10px', padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(t.id, 'in_progress'); }}>Start</button>
                                  )}
                                  {(t.status === 'open' || t.status === 'in_progress') && (
                                    <button className="btn btn-primary btn-sm" style={{ fontSize: '10px', padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(t.id, 'resolved'); }}>Resolve</button>
                                  )}
                                  {t.status === 'resolved' && (
                                    <button className="btn btn-ghost btn-sm" style={{ fontSize: '10px', padding: '3px 8px' }} onClick={(e) => { e.stopPropagation(); handleUpdateTicketStatus(t.id, 'closed'); }}>Close</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    )}

        {/* TAB 6: Support Analytics (Admin View) */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard />
        )}

      </div>

    </div>
  );
}
