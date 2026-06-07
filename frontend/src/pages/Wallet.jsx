import React, { useState, useEffect } from 'react';
import { truncateAddress, getExplorerAddressUrl } from '../hooks/useContract';
import { Ic } from '../components/Icons';
import { API_BASE } from '../config';

export default function Wallet({ wallet }) {
  const [copied, setCopied] = useState(false);
  const [prosPrice, setProsPrice] = useState(0.636);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${API_BASE}/rates`);
        const data = await res.json();
        if (data.success && data.rates && data.rates['PROS/USD']) {
          setProsPrice(data.rates['PROS/USD'].price);
        }
      } catch (err) {
        console.warn("Wallet: Failed to fetch live rates:", err.message);
      }
    };
    fetchRates();
  }, []);

  const handleCopy = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExplorer = () => {
    if (wallet.address) {
      window.open(getExplorerAddressUrl(wallet.address), '_blank');
    }
  };

  // Generate a unique visual gradient avatar based on address
  const getAvatarStyle = () => {
    if (!wallet.address) return { background: 'var(--primary-light)' };
    const color1 = wallet.address.slice(2, 8) || '2563eb';
    const color2 = wallet.address.slice(8, 14) || '10b981';
    return {
      background: `linear-gradient(135deg, #${color1} 0%, #${color2} 100%)`
    };
  };

  return (
    <div className="page-enter" style={{ padding: "24px", maxWidth: "520px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justify: "space-between", marginBottom: "28px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", margin: 0 }}>Wallet Status</h2>
      </div>

      {wallet.isConnected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Top Card */}
          <div className="card" style={{ padding: "24px", background: "var(--bg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
              <div style={{ 
                width: "48px", 
                height: "48px", 
                borderRadius: "50%", 
                ...getAvatarStyle(),
                border: "1.5px solid var(--border)",
                flexShrink: 0
              }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {wallet.address}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                  <span style={{ width: "6px", height: "6px", background: "var(--success)", borderRadius: "50%" }} />
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>
                    Connected to Pharos Testnet
                  </span>
                </div>
              </div>
            </div>

            {/* Balances Section */}
            <div style={{ background: "var(--bg-secondary)", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 700 }}>PROS BALANCE</span>
                <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)" }}>
                  {wallet.prosBalance} PROS
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 700 }}>PHRS (NATIVE) BALANCE</span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)" }}>
                  {wallet.phrsBalance} PHRS
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
              <span style={{ color: "var(--text-secondary)" }}>USD Value:</span>
              <strong style={{ color: "var(--primary)" }}>
                ≈ ${(parseFloat(wallet.prosBalance || 0) * prosPrice).toFixed(2)} USD
              </strong>
            </div>
          </div>

          {/* Action Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
            <button className="btn btn-secondary" onClick={handleCopy} style={{ justifyContent: "center", height: "45px" }}>
              <Ic name="copy" size={15} color="var(--text-secondary)" />
              {copied ? "Address Copied!" : "Copy Wallet Address"}
            </button>
            <button className="btn btn-secondary" onClick={handleExplorer} style={{ justifyContent: "center", height: "45px" }}>
              <Ic name="ext" size={15} color="var(--text-secondary)" />
              View Block Explorer
            </button>
            <button className="btn btn-danger" onClick={wallet.disconnect} style={{ justifyContent: "center", height: "45px" }}>
              <Ic name="disc" size={15} color="var(--danger-dark)" />
              Disconnect Wallet Connection
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ 
            width: "60px", 
            height: "60px", 
            margin: "0 auto 16px",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center"
          }}>
            <img 
              src="/assets/branding/logo.png" 
              alt="Pharos Logo" 
              style={{ width: "60px", height: "60px", objectFit: "contain" }} 
            />
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: 800, marginBottom: "8px" }}>Wallet Offline</h3>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" }}>
            Connect MetaMask to check balances and execute instant fiat payments.
          </p>
          <button className="btn btn-primary" onClick={wallet.connect} style={{ padding: "12px 24px" }}>
            Connect MetaMask Wallet
          </button>
        </div>
      )}
    </div>
  );
}
