import React, { useState, useEffect, useRef } from 'react';
import { truncateAddress, getExplorerAddressUrl } from '../hooks/useContract';
import { APP_CONFIG } from '../config';
import { Ic } from './Icons';

export default function WalletButton({ wallet, isSidebar = false }) {
  const { address, tokenBalance, isConnected, isConnecting, isCorrectNetwork, connect, switchNetwork, disconnect } = wallet;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExplorer = (e) => {
    e.stopPropagation();
    if (address) {
      window.open(getExplorerAddressUrl(address), '_blank');
    }
  };

  // Generate a unique gradient background using the wallet address
  const getAvatarStyle = () => {
    if (!address) return { background: 'var(--primary-light)' };
    const color1 = address.slice(2, 8) || '2563eb';
    const color2 = address.slice(8, 14) || '10b981';
    return {
      background: `linear-gradient(135deg, #${color1} 0%, #${color2} 100%)`
    };
  };

  if (isConnecting) {
    return (
      <button className="btn btn-secondary" style={{ width: '100%', borderRadius: '10px', padding: '10px 14px' }} disabled>
        <div style={{ width: '14px', height: '14px', border: '2px solid var(--text-secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '6px' }} />
        <span style={{ fontSize: '13px' }}>Connecting...</span>
      </button>
    );
  }

  // Sidebar Connected Layout
  if (isSidebar && isConnected) {
    if (!isCorrectNetwork) {
      return (
        <button 
          className="btn btn-danger" 
          onClick={switchNetwork} 
          style={{ 
            width: '100%',
            borderRadius: '10px', 
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '13px'
          }}
        >
          <Ic name="alert" size={14} color="var(--danger-dark)" />
          Switch Network
        </button>
      );
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Address Line */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{ 
              width: '24px', 
              height: '24px', 
              borderRadius: '50%', 
              ...getAvatarStyle(),
              border: '1px solid var(--border)',
              flexShrink: 0
            }} />
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {truncateAddress(address)}
            </span>
          </div>
          <button 
            onClick={handleCopy}
            className="btn btn-ghost"
            style={{ padding: '4px', borderRadius: '6px', background: 'transparent' }}
            title="Copy Address"
          >
            <Ic name={copied ? "check" : "copy"} size={13} color={copied ? "var(--success)" : "var(--text-secondary)"} />
          </button>
        </div>

        {/* Balance Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Balance</span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
            {parseFloat(tokenBalance).toFixed(2)} PROS
          </span>
        </div>

        {/* Quick controls */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleExplorer} 
            style={{ flex: 1, padding: '5px', fontSize: '11px', justifyContent: 'center', minWidth: 0 }}
          >
            Explorer
          </button>
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => disconnect()} 
            style={{ flex: 1, padding: '5px', fontSize: '11px', color: 'var(--danger-dark)', justifyContent: 'center', minWidth: 0 }}
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // Sidebar Disconnected Layout
  if (isSidebar && !isConnected) {
    return (
      <button 
        className="btn btn-primary" 
        onClick={connect} 
        style={{ 
          width: '100%',
          borderRadius: '10px', 
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '13px'
        }}
      >
        <span style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%' }} />
        Connect Wallet
      </button>
    );
  }

  // Header / Standard Layout
  if (!isConnected) {
    return (
      <button 
        className="btn btn-secondary" 
        onClick={connect} 
        style={{ 
          borderRadius: '8px', 
          height: '38px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px'
        }}
      >
        <span style={{ width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%' }} />
        Connect Wallet
      </button>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <button 
        className="btn btn-danger" 
        onClick={switchNetwork} 
        style={{ 
          borderRadius: '8px', 
          height: '38px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px'
        }}
      >
        <Ic name="alert" size={14} color="var(--danger-dark)" />
        Switch Network
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        className="btn btn-secondary" 
        onClick={() => setDropdownOpen(!dropdownOpen)}
        style={{ 
          borderRadius: '8px', 
          height: '38px',
          padding: '4px 10px 4px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px'
        }}
      >
        <div style={{ 
          width: '24px', 
          height: '24px', 
          borderRadius: '50%', 
          ...getAvatarStyle(),
          border: '1px solid var(--border)'
        }} />
        <span style={{ fontWeight: 600 }}>{truncateAddress(address)}</span>
        <span style={{ opacity: 0.15 }}>|</span>
        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{parseFloat(tokenBalance).toFixed(2)} PROS</span>
      </button>

      {dropdownOpen && (
        <div className="wallet-dropdown">
          <div className="wallet-dropdown-header">
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              ...getAvatarStyle()
            }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {truncateAddress(address)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Pharos Testnet</span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleCopy} 
              style={{ width: '100%', justifyContent: 'flex-start', gap: '8px' }}
            >
              <Ic name={copied ? "check" : "copy"} size={14} color={copied ? "var(--success)" : "var(--text-secondary)"} />
              {copied ? "Copied" : "Copy Address"}
            </button>
            
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleExplorer} 
              style={{ width: '100%', justifyContent: 'flex-start', gap: '8px' }}
            >
              <Ic name="ext" size={14} color="var(--text-secondary)" />
              View Explorer
            </button>

            <button 
              className="btn btn-secondary btn-sm" 
              onClick={connect} 
              style={{ width: '100%', justifyContent: 'flex-start', gap: '8px' }}
            >
              <Ic name="sw" size={14} color="var(--text-secondary)" />
              Switch Wallet
            </button>

            <button 
              className="btn btn-danger btn-sm" 
              onClick={() => { disconnect(); setDropdownOpen(false); }} 
              style={{ width: '100%', justifyContent: 'flex-start', gap: '8px' }}
            >
              <Ic name="disc" size={14} color="var(--danger-dark)" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
