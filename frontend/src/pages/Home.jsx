import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayments } from '../context/PaymentContext';
import { CURRENCIES, API_BASE } from '../config';
import { Ic } from '../components/Icons';
import ReceiptViewer from '../components/ReceiptViewer';

export default function Home({ wallet }) {
  const navigate = useNavigate();
  const { payments, loading: loadingTx, error, globalStats, userPaymentCount, refreshPayments } = usePayments();
  const [receiptPayment, setReceiptPayment] = useState(null);

  // Smart Greeting logic helpers
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return { text: "Good Night", icon: "🌙" };
    if (hour < 12) return { text: "Good Morning", icon: "☀️" };
    if (hour < 17) return { text: "Good Afternoon", icon: "🌤️" };
    if (hour < 21) return { text: "Good Evening", icon: "🌇" };
    return { text: "Good Night", icon: "🌙" };
  };

  const getFormattedDateTime = () => {
    const now = new Date();
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    const weekday = weekdays[now.getDay()];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${weekday}, ${month} ${day}, ${year} • ${hours}:${minutes}`;
  };

  const [greeting, setGreeting] = useState(getGreeting());
  const [dateTime, setDateTime] = useState(getFormattedDateTime());
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [prosPrice, setProsPrice] = useState(0.636);

  const [clickCount, setClickCount] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState(null);

  const handleHeaderClick = () => {
    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowDebug(curr => !curr);
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${API_BASE}/rates`);
        const data = await res.json();
        if (data.success && data.rates && data.rates['PROS/USD']) {
          setProsPrice(data.rates['PROS/USD'].price);
        }
      } catch (err) {
        console.warn("Home: Failed to fetch live rates:", err.message);
      }
    };
    fetchRates();
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showDebug) return;
    const fetchDebug = async () => {
      try {
        const res = await fetch(`${API_BASE}/rates/debug`);
        const data = await res.json();
        if (data.success) {
          setDebugData(data.debug);
        }
      } catch (err) {
        console.warn("Failed to fetch debug rates:", err);
      }
    };
    fetchDebug();
    const interval = setInterval(fetchDebug, 2000);
    return () => clearInterval(interval);
  }, [showDebug]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreeting());
      setDateTime(getFormattedDateTime());
    }, 10000); // refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Refresh latest transactions on wallet connection/changes
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      refreshPayments();
    }
  }, [wallet.isConnected, wallet.address]);

  // Dynamic Volume Chart mapping real transactions from the past 7 days
  const getWeeklyVolumeData = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayVolumes = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const dayUsd = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    payments.forEach(p => {
      const pDate = new Date(p.timestamp);
      if (pDate >= oneWeekAgo) {
        const dayName = days[pDate.getDay()];
        const amt = parseFloat(p.prosAmount) || 0;
        const rate = parseFloat(p.prosPriceAtExecution) || 0;
        if (dayVolumes[dayName] !== undefined) {
          dayVolumes[dayName] += amt;
          dayUsd[dayName] += amt * rate;
        }
      }
    });

    return [
      { day: "Mon", vol: dayVolumes.Mon, usd: dayUsd.Mon },
      { day: "Tue", vol: dayVolumes.Tue, usd: dayUsd.Tue },
      { day: "Wed", vol: dayVolumes.Wed, usd: dayUsd.Wed },
      { day: "Thu", vol: dayVolumes.Thu, usd: dayUsd.Thu },
      { day: "Fri", vol: dayVolumes.Fri, usd: dayUsd.Fri },
      { day: "Sat", vol: dayVolumes.Sat, usd: dayUsd.Sat },
      { day: "Sun", vol: dayVolumes.Sun, usd: dayUsd.Sun }
    ];
  };

  // Dynamic Country Payouts Breakdown mapping real countries in payments list
  const getCountryBreakdown = () => {
    const counts = {};
    payments.forEach(p => {
      const c = p.country || 'Others';
      counts[c] = (counts[c] || 0) + 1;
    });

    const total = payments.length || 1;
    
    const countryMapping = {
      IN: { flag: "🇮🇳", name: "India", color: "#2563eb" },
      BR: { flag: "🇧🇷", name: "Brazil", color: "#10b981" },
      SG: { flag: "🇸🇬", name: "Singapore", color: "#8b5cf6" },
      US: { flag: "🇺🇸", name: "USA", color: "#f59e0b" },
      TH: { flag: "🇹🇭", name: "Thailand", color: "#ec4899" },
      ID: { flag: "🇮🇩", name: "Indonesia", color: "#06b6d4" },
      Others: { flag: "🌍", name: "Others", color: "#64748b" }
    };

    return Object.entries(counts).map(([code, count]) => {
      const info = countryMapping[code] || countryMapping.Others;
      return {
        flag: info.flag,
        name: info.name,
        count,
        percentage: Math.round((count / total) * 100),
        color: info.color
      };
    }).sort((a, b) => b.count - a.count);
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handlePrintReceipt = (tx) => {
    const printWindow = window.open('about:blank', 'PrintReceipt', 'left=50000,top=50000,width=0,height=0');
    const cc = CURRENCIES[tx.fiatCurrency] || { flag: "🌍", symbol: "$" };
    printWindow.document.write(`
      <html>
        <head>
          <title>PharosPay Invoice Receipt</title>
          <style>
            body { font-family: 'DM Sans', sans-serif; color: #0f172a; padding: 40px; }
            .receipt { max-width: 460px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h3>PharosPay Payment Receipt</h3>
              <p style="font-size:12px;color:#64748b;">Instant Cross-Border Settlement</p>
            </div>
            <div class="row"><span>Merchant</span><strong>${tx.merchantName}</strong></div>
            <div class="row"><span>Merchant ID</span><strong>${tx.merchantId}</strong></div>
            <div class="row"><span>Country</span><strong>${tx.country}</strong></div>
            <div class="row"><span>Payment Rail</span><strong>${tx.paymentRail}</strong></div>
            <div class="row"><span>Fiat Amount</span><strong>${cc.symbol}${tx.fiatAmount.toFixed(2)} ${tx.fiatCurrency}</strong></div>
            <div class="row"><span>PROS Spent</span><strong>${tx.prosAmount} PROS</strong></div>
            <div class="row"><span>Fee Paid</span><strong>${tx.feeAmount} PROS</strong></div>
            <div class="row"><span>Date</span><strong>${new Date(tx.timestamp).toLocaleString()}</strong></div>
            <div class="row"><span>Status</span><strong>${tx.status} / COMPLETED</strong></div>
            <div style="margin-top:14px;padding-top:14px;border-top:2px solid #e2e8f0;font-size:10px;color:#64748b;font-family:monospace;word-break:break-all;">
              TxHash: ${tx.id}
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

  // Derive layout inputs from context
  const chartPoints = getWeeklyVolumeData();
  const countriesBreakdown = getCountryBreakdown();
  const recentTx = payments.slice(0, 5); // latest 5 transactions

  const userVolPROS = payments.reduce((acc, p) => acc + (parseFloat(p.prosAmount) || 0), 0);
  const userVolUSD = payments.reduce((acc, p) => acc + ((parseFloat(p.prosAmount) || 0) * (parseFloat(p.prosPriceAtExecution) || 0)), 0);
  const userFeesUSD = payments.reduce((acc, p) => acc + ((parseFloat(p.feeAmount) || 0) * (parseFloat(p.prosPriceAtExecution) || 0)), 0);

  const statsItems = [
    { label: "Total Payments", value: wallet.isConnected ? userPaymentCount.toString() : "0", sub: `${globalStats.paymentCount} globally`, icon: "send", color: "#2563eb" },
    { label: "Total Volume", value: wallet.isConnected ? `${userVolPROS.toFixed(1)} PROS` : "0.0 PROS", sub: wallet.isConnected ? `≈ $${userVolUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD` : `${parseFloat(globalStats.volume).toFixed(1)} PROS globally`, icon: "zap", color: "#10b981" },
    { label: "Platform Fees", value: wallet.isConnected ? `$${userFeesUSD.toFixed(2)} USD` : "$0.00 USD", sub: "Based on execution rates", icon: "shield", color: "#8b5cf6" },
    { label: "Active Network", value: wallet.isConnected ? "Pharos Atlantic" : "Offline", sub: wallet.isConnected ? "Chain ID: 688689" : "Connect MetaMask", icon: "globe", color: "#f59e0b" }
  ];

  const quickActions = [
    { label: "Send Payment", icon: "send", desc: "Send instant cross-border global payouts.", color: "#2563eb", action: () => navigate('/pay') },
    { label: "Scan QR", icon: "qr", desc: "Scan unique merchant QR codes for automated checkout.", color: "#10b981", action: () => navigate('/scan') },
    { label: "View History", icon: "history", desc: "Browse your past transactions, confirmations, and receipts.", color: "#8b5cf6", action: () => navigate('/history') },
    { label: "Wallet", icon: "wallet", desc: "Check your token balances, addresses, and transaction gas.", color: "#f59e0b", action: () => navigate('/wallet') },
    { label: "Merchant OS", icon: "globe", desc: "Onboard payout beneficiaries, manage KYC, and manage retail profiles.", color: "#ec4899", action: () => navigate('/merchant') },
    { label: "Analytics", icon: "chart", desc: "Monitor weekly transaction volume graphs and country payouts.", color: "#06b6d4", action: () => {
      const el = document.getElementById('analytics-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }}
  ];

  // Derive SVG path points for line chart
  const getSvgPathData = () => {
    const width = 500;
    const height = 150;
    const padding = 20;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const maxVol = Math.max(...chartPoints.map(p => p.vol));
    const scaleMax = Math.max(maxVol, 10);
    
    const coords = chartPoints.map((p, idx) => {
      const x = padding + (idx / (chartPoints.length - 1)) * chartW;
      const y = padding + chartH - (p.vol / (scaleMax || 1)) * chartH;
      return { x, y };
    });

    const getCurvePath = (points) => {
      if (points.length === 0) return "";
      let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) / 3;
        const cpY1 = p0.y;
        const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
        const cpY2 = p1.y;
        path += ` C ${cpX1.toFixed(1)} ${cpY1.toFixed(1)}, ${cpX2.toFixed(1)} ${cpY2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }
      return path;
    };

    const linePath = getCurvePath(coords);
    const fillPath = coords.length > 0 ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(height - padding).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(height - padding).toFixed(1)} Z` : "";
    
    return { linePath, fillPath, coords };
  };

  const { linePath, fillPath, coords } = getSvgPathData();

  return (
    <div className="page-enter" style={{ padding: "24px" }}>
      {/* Header Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "24px" }}>
        <div>
          <h1 
            onClick={handleHeaderClick}
            style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px", cursor: "pointer", userSelect: "none" }}
          >
            {greeting.text} {greeting.icon}
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px", fontWeight: 500 }}>
            {dateTime}
          </p>
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
        gap: "16px", 
        marginBottom: "24px" 
      }}>
        {statsItems.map(item => (
          <div className="card interactive" key={item.label} style={{ padding: "24px", background: "var(--bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  {item.label}
                </p>
                <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)", marginBottom: "8px", letterSpacing: "-0.5px" }}>
                  {item.value}
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-subtitle)", margin: 0 }}>
                  {item.sub}
                </p>
              </div>
              <div style={{ 
                width: "40px", 
                height: "40px", 
                borderRadius: "10px", 
                background: item.color + "12", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                flexShrink: 0 
              }}>
                <Ic name={item.icon} size={20} color={item.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Services Panel */}
      <div className="card" style={{ padding: "24px", marginBottom: "24px", background: "var(--bg)" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Quick Services
        </h3>
        <div className="services-grid">
          {quickActions.map(action => (
            <div 
              className="card interactive" 
              key={action.label} 
              onClick={action.action}
              style={{ 
                padding: "16px", 
                display: "flex", 
                flexDirection: "column", 
                gap: "16px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                cursor: "pointer"
              }}
            >
              <div style={{ 
                width: "40px", 
                height: "40px", 
                borderRadius: "10px", 
                background: action.color + "15", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                flexShrink: 0
              }}>
                <Ic name={action.icon} size={18} color={action.color} />
              </div>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "8px" }}>
                  {action.label}
                </h4>
                <p style={{ fontSize: "12px", color: "var(--text-subtitle)", lineHeight: "1.4", margin: 0 }}>
                  {action.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics & breakdown block */}
      <div id="analytics-section" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginBottom: "24px", alignItems: "start" }}>
        {/* Weekly Volume Line Chart */}
        <div className="card" style={{ padding: "24px", background: "var(--bg)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Weekly Payout Volume (PROS)
          </h3>
          <div style={{ position: "relative", width: "100%", height: "150px" }}>
            <svg viewBox="0 0 500 150" width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="20" y1="20" x2="480" y2="20" stroke="var(--border-light)" strokeDasharray="3" />
              <line x1="20" y1="75" x2="480" y2="75" stroke="var(--border-light)" strokeDasharray="3" />
              <line x1="20" y1="130" x2="480" y2="130" stroke="var(--border-light)" strokeDasharray="3" />
              
              <path d={fillPath} fill="url(#chart-grad)" />
              <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
              
              {/* Dot coordinates & hover zones */}
              {coords.map((c, i) => (
                <g 
                  key={i}
                  onMouseEnter={() => setHoveredPoint({ ...c, ...chartPoints[i] })}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <circle cx={c.x} cy={c.y} r="16" fill="transparent" style={{ cursor: "pointer", pointerEvents: "all" }} />
                  <circle cx={c.x} cy={c.y} r="5" fill="var(--bg)" stroke="var(--primary)" strokeWidth="3" />
                </g>
              ))}
            </svg>

            {hoveredPoint && (
              <div style={{
                position: 'absolute',
                left: `${(hoveredPoint.x / 500) * 100}%`,
                top: `${(hoveredPoint.y / 150) * 100 - 50}%`,
                transform: 'translateX(-50%)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '11px',
                boxShadow: 'var(--shadow-lg)',
                pointerEvents: 'none',
                zIndex: 10,
                whiteSpace: 'nowrap',
              }}>
                <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '2px' }}>{hoveredPoint.day}</div>
                <div style={{ color: 'var(--primary)', fontWeight: 800 }}>{hoveredPoint.vol.toFixed(2)} PROS</div>
                <div style={{ color: 'var(--text-subtitle)' }}>≈ ${hoveredPoint.usd.toFixed(2)} USD</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", marginTop: "16px", fontSize: "11px", color: "var(--text-secondary)" }}>
            {chartPoints.map(p => <span key={p.day}>{p.day}</span>)}
          </div>
        </div>

        {/* Country breakdown List */}
        <div className="card" style={{ padding: "24px", background: "var(--bg)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Country Breakdown
          </h3>
          {countriesBreakdown.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "150px", color: "var(--text-tertiary)", fontSize: "13px" }}>
              No payments data resolved
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {countriesBreakdown.map(c => (
                <div key={c.name} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {c.count} txs ({c.percentage}%)
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "8px", background: "var(--bg-tertiary)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${c.percentage}%`, height: "100%", background: c.color, borderRadius: "4px" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="card" style={{ background: "var(--bg)", marginBottom: "24px" }}>
        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)", margin: 0 }}>Recent Activity</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
            View all <Ic name="arrow" size={14} color="var(--text-secondary)" />
          </button>
        </div>

        {!wallet.isConnected ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
            <p style={{ fontSize: "14px" }}>Connect your wallet to see recent activity details.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: "16px" }} onClick={wallet.connect}>
              Connect Wallet
            </button>
          </div>
        ) : loadingTx ? (
          /* Pulse skeleton loader */
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 0", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--border-light)", animation: "pulse 1.5s infinite" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: "120px", height: "14px", background: "var(--border-light)", borderRadius: "4px", marginBottom: "8px", animation: "pulse 1.5s infinite" }} />
                  <div style={{ width: "80px", height: "10px", background: "var(--border-light)", borderRadius: "3px", animation: "pulse 1.5s infinite" }} />
                </div>
                <div style={{ width: "60px", height: "20px", background: "var(--border-light)", borderRadius: "4px", animation: "pulse 1.5s infinite" }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--danger-dark)" }}>
            <p style={{ fontSize: "14px", fontWeight: 700 }}>Failed to sync payment records</p>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>{error}</p>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: "16px" }} onClick={refreshPayments}>
              Retry Sync
            </button>
          </div>
        ) : (payments.length === 0 && globalStats.paymentCount === 0) ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Ic name="history" size={24} color="var(--text-tertiary)" />
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>No payments processed yet.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: "16px" }} onClick={() => navigate('/pay')}>
              Make Your First Payment
            </button>
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Country</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map((tx) => {
                  const curConfig = CURRENCIES[tx.fiatCurrency] || { flag: "🌍", symbol: "$" };
                  const isSettled = tx.status === 'SETTLED';
                  
                  return (
                    <tr key={tx.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            width: "36px", 
                            height: "36px", 
                            borderRadius: "8px", 
                            background: "var(--bg-secondary)", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center", 
                            fontSize: "18px", 
                            flexShrink: 0 
                          }}>
                            {curConfig.flag}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{tx.merchantName}</span>
                              <span className="badge" style={{ background: "var(--primary-light)", color: "var(--primary)", fontSize: "9px", padding: "1px 6px" }}>
                                {tx.paymentRail}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID: {tx.merchantId}</span>
                          </div>
                        </div>
                      </td>
                      
                      <td>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {tx.country}
                        </span>
                      </td>

                      <td>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                            {curConfig.symbol}{tx.fiatAmount.toFixed(2)} {tx.fiatCurrency}
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {tx.prosAmount} PROS
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`badge badge-${isSettled ? 'success' : tx.status.toLowerCase()}`}>
                          {isSettled ? 'Completed' : tx.status}
                        </span>
                      </td>

                      <td>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                            {tx.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {formatTimeAgo(tx.timestamp)}
                          </div>
                        </div>
                      </td>

                      <td>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setReceiptPayment(tx)} 
                          style={{ padding: "6px 12px", borderRadius: "6px" }}
                        >
                          Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEVELOPER DEBUG PANEL */}
      {showDebug && (
        <div className="card" style={{ 
          marginTop: "28px", 
          padding: "20px", 
          background: "var(--bg-secondary)", 
          border: "2px dashed var(--primary)", 
          borderRadius: "12px",
          boxShadow: "var(--shadow-md)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
              🔧 Developer Admin Debug Panel
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowDebug(false)} style={{ padding: "4px 8px", fontSize: "11px" }}>Hide</button>
          </div>

          {!debugData ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <div style={{ width: "12px", height: "12px", border: "1.5px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              Connecting to Coinbase ticker cache...
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
              <div style={{ background: "var(--bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", display: "block", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Current PROS Price</span>
                <strong style={{ fontSize: "16px", color: "var(--text)", fontWeight: 800 }}>${parseFloat(debugData.price || 0).toFixed(4)}</strong>
              </div>
              <div style={{ background: "var(--bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", display: "block", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Coinbase Status</span>
                <span className={`badge ${debugData.coinbaseStatus === 'Online' ? 'badge-success' : debugData.coinbaseStatus.includes('Degraded') ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: "12px", padding: "4px 8px", display: "inline-block", fontWeight: 800 }}>
                  {debugData.coinbaseStatus}
                </span>
              </div>
              <div style={{ background: "var(--bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", display: "block", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Cache Age</span>
                <strong style={{ fontSize: "15px", color: debugData.ageSeconds >= debugData.staleLimitSeconds ? "var(--danger-dark)" : "var(--text)", fontWeight: 800 }}>
                  {debugData.ageSeconds}s / {debugData.staleLimitSeconds}s max
                </strong>
                <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "2px" }}>TTL: {debugData.cacheTtlSeconds}s</div>
              </div>
              <div style={{ background: "var(--bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", display: "block", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Last Refresh</span>
                <strong style={{ fontSize: "13px", color: "var(--text)", fontWeight: 700 }}>
                  {new Date(debugData.updatedAt).toLocaleTimeString()}
                </strong>
              </div>
              <div style={{ gridColumn: "span 2", background: "var(--bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", display: "block", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Price Source & Timestamp</span>
                <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                  Source: {debugData.source} <br />
                  Timestamp: {debugData.updatedAt} ({new Date(debugData.updatedAt).toISOString()})
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Receipt Viewer Modal */}
      {receiptPayment && (
        <ReceiptViewer
          payment={receiptPayment}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </div>
  );
}
