import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, ABI, CURRENCIES } from '../config';
import { formatPROS, getExplorerTxUrl } from '../hooks/useContract';
import { Ic } from '../components/Icons';
import { usePayments } from '../context/PaymentContext';
import ReceiptViewer from '../components/ReceiptViewer';

export default function History({ wallet }) {
  const { payments, loading: isLoading, refreshPayments } = usePayments();
  
  // Search & Filter States
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all"); // all | today | week | month
  const [sortOrder, setSortOrder] = useState("desc"); // desc = newest, asc = oldest
  const [receiptPayment, setReceiptPayment] = useState(null); // For receipt viewer modal
  
  const [isMob, setIsMob] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMob(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      refreshPayments();
    }
  }, [wallet.isConnected, wallet.address]);

  // Export CSV helper
  const handleExportCSV = () => {
    if (payments.length === 0) return;
    
    const headers = ["Date", "Merchant Name", "Merchant ID", "Method", "Amount (fiat)", "Currency", "PROS Paid", "Fee Paid", "Status", "TxHash"];
    const rows = filteredPayments.map(p => [
      p.timestamp.toLocaleString(),
      p.merchantName,
      p.merchantId,
      p.paymentRail,
      p.fiatAmount,
      p.fiatCurrency,
      p.prosAmount,
      p.feeAmount,
      p.status,
      p.id
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pharospay_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter & sort computations
  const filteredPayments = payments
    .filter(p => {
      // Match merchant name, merchant ID, rail, or transaction hash
      const matchesSearch = p.merchantName.toLowerCase().includes(search.toLowerCase()) || 
                            p.merchantId.toLowerCase().includes(search.toLowerCase()) || 
                            p.paymentRail.toLowerCase().includes(search.toLowerCase()) ||
                            p.id.toLowerCase().includes(search.toLowerCase());
      
      const matchesCountry = countryFilter === "all" || p.country === countryFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      
      // Date filter check
      let matchesDate = true;
      if (dateFilter !== "all") {
        const now = new Date();
        const diffTime = Math.abs(now - p.timestamp);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (dateFilter === "today") {
          matchesDate = p.timestamp.toDateString() === now.toDateString();
        } else if (dateFilter === "week") {
          matchesDate = diffDays <= 7;
        } else if (dateFilter === "month") {
          matchesDate = diffDays <= 30;
        }
      }
      
      return matchesSearch && matchesCountry && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  if (!wallet.isConnected) {
    return (
      <div className="page-enter" style={{ padding: "40px 24px", textAlign: "center", maxWidth: "480px", margin: "40px auto" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justify: "center", margin: "0 auto 16px" }}>
          <Ic name="history" size={32} color="var(--primary)" />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 800, marginBottom: "8px" }}>View History</h3>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" }}>
          Connect your wallet to retrieve your transaction records from the block explorer.
        </p>
        <button className="btn btn-primary" onClick={wallet.connect}>
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ padding: "24px" }}>
      {/* Title Block */}
      <div style={{ display: "flex", alignItems: "center", justify: "space-between", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", margin: 0 }}>Transactions</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            {filteredPayments.length} records found
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} disabled={filteredPayments.length === 0}>
          <Ic name="dl" size={14} color="var(--text-secondary)" /> Export CSV
        </button>
      </div>

      {/* Filter and search controllers */}
      <div className="card" style={{ padding: "16px", marginBottom: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", alignItems: "end" }}>
          {/* Search bar */}
          <div className="form-group" style={{ marginBottom: 0, gridColumn: isMob ? "span 1" : "span 2" }}>
            <label className="form-label">Search</label>
            <div className="form-input-wrapper">
              <span className="form-prefix" style={{ padding: "0 8px 0 12px" }}>
                <Ic name="search" size={15} color="var(--text-secondary)" />
              </span>
              <input 
                className="form-input" 
                type="text" 
                placeholder="Merchant, Hash, ID..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
          </div>

          {/* Country filter dropdown */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Country</label>
            <div className="form-input-wrapper">
              <select 
                className="form-input" 
                value={countryFilter} 
                onChange={(e) => setCountryFilter(e.target.value)}
                style={{ border: "none", background: "transparent" }}
              >
                <option value="all">🌍 All Countries</option>
                <option value="IN">🇮🇳 India</option>
                <option value="BR">🇧🇷 Brazil</option>
                <option value="SG">🇸🇬 Singapore</option>
                <option value="US">🇺🇸 USA</option>
                <option value="TH">🇹🇭 Thailand</option>
                <option value="ID">🇮🇩 Indonesia</option>
              </select>
            </div>
          </div>

          {/* Status filter dropdown */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <div className="form-input-wrapper">
              <select 
                className="form-input" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ border: "none", background: "transparent" }}
              >
                <option value="all">All Status</option>
                <option value="SETTLED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          {/* Date range filter dropdown */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Date Range</label>
            <div className="form-input-wrapper">
              <select 
                className="form-input" 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ border: "none", background: "transparent" }}
              >
                <option value="all">📅 All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Sort order toggle */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sort Date</label>
            <button 
              className="btn btn-secondary" 
              style={{ width: "100%", justifyContent: "space-between", height: "45px" }}
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            >
              <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
              <Ic name="sw" size={14} color="var(--text-secondary)" />
            </button>
          </div>
        </div>
      </div>

      {/* List Layout Rendering */}
      {isLoading ? (
        <div style={{ padding: "48px", textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ width: "32px", height: "32px", border: "3px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px" }}>Retrieving transactions from blockchain...</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="card" style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justify: "center", margin: "0 auto 12px" }}>
            <Ic name="history" size={24} color="var(--text-tertiary)" />
          </div>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
            No matching transactions found.
          </p>
        </div>
      ) : isMob ? (
        /* Mobile Card Layout Feed */
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredPayments.map(p => {
            const cc = CURRENCIES[p.fiatCurrency] || { symbol: '$', flag: '🌍' };
            return (
              <div className="card" key={p.id} style={{ padding: "16px" }}>
                <div style={{ display: "flex", justify: "space-between", marginBottom: "10px", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "24px" }}>{cc.flag}</span>
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", margin: 0 }}>
                        {p.merchantName}
                      </p>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                        {p.paymentRail}
                      </p>
                    </div>
                  </div>
                  <span className={`badge badge-${p.status.toLowerCase()}`}>
                    {p.status === 'SETTLED' ? 'Completed' : p.status}
                  </span>
                </div>
                
                <div style={{ display: "flex", justify: "space-between", borderTop: "1px solid var(--border-light)", paddingTop: "10px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {p.timestamp.toLocaleDateString()} {p.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)" }}>
                      {cc.symbol}{p.fiatAmount.toFixed(2)}
                    </span>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>
                      {p.prosAmount} PROS
                    </p>
                  </div>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)", marginTop: "8px", borderTop: "1px dashed var(--border-light)", paddingTop: "8px" }}>
                  <span>PROS Price: ${Number(p.prosPriceAtExecution || 0).toFixed(4)}</span>
                  <span>FX Rate: 1 USD = {Number(p.fxRateAtExecution || 0).toFixed(2)} {p.fiatCurrency}</span>
                </div>

                <button
                  onClick={() => setReceiptPayment(p)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', gap: '6px', marginTop: '8px', fontSize: '12px' }}
                >
                  <Ic name="receipt" size={13} color="var(--text-secondary)" />
                  View Receipt
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Table Layout */
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Method</th>
                  <th>Amount (fiat)</th>
                  <th>PROS Amount</th>
                  <th>Exchange Rates</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th>TxHash Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(p => {
                  const cc = CURRENCIES[p.fiatCurrency] || { symbol: '$', flag: '🌍' };
                  return (
                    <tr key={p.id}>
                      <td style={{ color: "var(--text-secondary)", fontSize: "13px", whiteSpace: "nowrap" }}>
                        {p.timestamp.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "18px" }}>{cc.flag}</span>
                          <div>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                              {p.merchantName}
                            </span>
                            <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0, fontFamily: "monospace" }}>
                              {p.merchantId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                          {p.paymentRail}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: "var(--text)" }}>
                        {cc.symbol}{p.fiatAmount.toFixed(2)}
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                        {p.prosAmount}
                      </td>
                      <td>
                        <div style={{ fontSize: "12px", color: "var(--text)", fontWeight: 600 }}>
                          PROS: ${Number(p.prosPriceAtExecution || 0).toFixed(4)}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          1 USD = {Number(p.fxRateAtExecution || 0).toFixed(2)} {p.fiatCurrency}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${p.status.toLowerCase()}`}>
                          {p.status === 'SETTLED' ? 'Completed' : p.status}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setReceiptPayment(p)}
                          className="btn btn-ghost btn-sm"
                          style={{ gap: '4px', fontSize: '11px', padding: '4px 8px' }}
                        >
                          <Ic name="receipt" size={12} color="var(--primary)" />
                          View
                        </button>
                      </td>
                      <td>
                        <a 
                          href={getExplorerTxUrl(p.id)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ textDecoration: "none" }}
                        >
                          <code className="btn btn-secondary btn-sm" style={{ fontFamily: "monospace", padding: "4px 8px" }}>
                            {p.id.slice(0, 8)}...
                            <Ic name="ext" size={12} color="var(--text-secondary)" style={{ marginLeft: "4px" }} />
                          </code>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
