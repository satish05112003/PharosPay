import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from './hooks/useWallet';
import Home from './pages/Home';
import Pay from './pages/Pay';
import History from './pages/History';
import Scan from './pages/Scan';
import Wallet from './pages/Wallet';
import MerchantDashboard from './pages/MerchantDashboard';
import Support from './pages/Support';
import VerifyReceipt from './pages/VerifyReceipt';
import ReceiptPage from './pages/ReceiptPage';
import WalletButton from './components/WalletButton';
import { Ic } from './components/Icons';
import ErrorBoundary from './components/ErrorBoundary';
import { PaymentProvider, usePayments } from './context/PaymentContext';
import './App.css';

const AppHeader = ({ theme, setTheme, wallet, isMob }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshPayments, loading } = usePayments();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const getPageTitle = (pathname) => {
    if (pathname === '/') return 'Dashboard';
    if (pathname.startsWith('/pay')) return 'Send Payment';
    if (pathname.startsWith('/scan')) return 'Scan QR Code';
    if (pathname.startsWith('/history')) return 'Payment History';
    if (pathname.startsWith('/wallet')) return 'My Wallet';
    if (pathname.startsWith('/merchant')) return 'Merchant OS';
    if (pathname.startsWith('/support')) return 'Support Center';
    return 'PharosPay';
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const handleRefresh = async () => {
    if (refreshPayments) {
      await refreshPayments();
    }
  };

  const showNotifications = () => {
    alert("System status: All networks operational. No new notices.");
  };

  return (
    <header className="app-header">
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isMob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <img 
              src="/assets/branding/logo.png" 
              alt="Pharos Logo" 
              style={{ 
                width: '32px', 
                height: '32px', 
                objectFit: 'contain'
              }} 
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <img 
              src="/assets/branding/logo.png" 
              alt="Pharos Logo" 
              style={{ 
                width: '32px', 
                height: '32px', 
                objectFit: 'contain'
              }} 
            />
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>PharosPay</span>
            <span style={{ borderLeft: '1px solid var(--border)', height: '20px', margin: '0 8px' }}></span>
            <h2 className="page-title" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>{getPageTitle(location.pathname)}</h2>
          </div>
        )}
      </div>

      <div className="header-right" style={{ position: 'relative' }}>
        {isMob ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="action-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Actions Menu"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)'
              }}
            >
              <Ic name="more" size={18} color="var(--text-secondary)" />
            </button>

            {mobileMenuOpen && (
              <div 
                className="mobile-action-menu" 
                style={{
                  position: 'absolute',
                  top: '46px',
                  right: 0,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  zIndex: 1000,
                  width: '200px',
                  boxSizing: 'border-box'
                }}
              >
                <button 
                  onClick={() => { handleRefresh(); setMobileMenuOpen(false); }} 
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', width: '100%', gap: '8px', borderRadius: '8px', height: '36px' }}
                >
                  <Ic name="refresh" size={14} className={loading ? "spin" : ""} />
                  Refresh
                </button>
                <button 
                  onClick={() => { cycleTheme(); }} 
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', width: '100%', gap: '8px', borderRadius: '8px', height: '36px' }}
                >
                  {isDark ? <Ic name="sun" size={14} color="var(--warning)" /> : <Ic name="moon" size={14} color="var(--primary)" />}
                  Theme: {theme.toUpperCase()}
                </button>
                <button 
                  onClick={() => { showNotifications(); setMobileMenuOpen(false); }} 
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', width: '100%', gap: '8px', borderRadius: '8px', height: '36px' }}
                >
                  <Ic name="bell" size={14} />
                  Notifications
                </button>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                  <WalletButton wallet={wallet} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="action-toolbar">
            <button 
              className="action-btn"
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh Dashboard"
            >
              <Ic name="refresh" size={16} color="var(--text-secondary)" className={loading ? "spin" : ""} />
            </button>

            <button 
              onClick={cycleTheme}
              className="action-btn"
              title={`Theme: ${theme.toUpperCase()} (Click to cycle)`}
              style={{ position: 'relative' }}
            >
              {isDark ? (
                <Ic name="sun" size={16} color="#f59e0b" strokeWidth={2.25} />
              ) : (
                <Ic name="moon" size={16} color="#2563eb" strokeWidth={2.25} />
              )}
              {theme === 'system' && (
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  fontSize: '8px',
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '1px 3px',
                  fontWeight: 800,
                  lineHeight: 1
                }}>
                  A
                </span>
              )}
            </button>

            <button 
              className="action-btn"
              onClick={showNotifications}
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <Ic name="bell" size={16} color="var(--text-secondary)" />
              <span style={{
                position: 'absolute',
                top: '9px',
                right: '9px',
                width: '6px',
                height: '6px',
                background: 'var(--danger)',
                borderRadius: '50%',
              }} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', height: '38px' }}>
              <WalletButton wallet={wallet} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

function Layout() {
  const wallet = useWallet();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMob, setIsMob] = useState(window.innerWidth < 768);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = document.documentElement;

    const applyTheme = (t) => {
      if (t === 'dark') {
        root.classList.add('dark');
      } else if (t === 'light') {
        root.classList.remove('dark');
      } else {
        // System preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        if (e.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  useEffect(() => {
    const handleResize = () => setIsMob(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'home' },
    { path: '/pay', label: 'Pay', icon: 'send' },
    { path: '/scan', label: 'Scan', icon: 'qr' },
    { path: '/history', label: 'History', icon: 'history' },
    { path: '/wallet', label: 'Wallet', icon: 'wallet' },
    { path: '/merchant', label: 'Merchant OS', icon: 'globe' },
    { path: '/support', label: 'Support', icon: 'help' },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const Logo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
      <img 
        src="/assets/branding/logo.png" 
        alt="Pharos Logo" 
        style={{ 
          width: '42px', 
          height: '42px', 
          objectFit: 'contain',
          flexShrink: 0
        }} 
      />
      <div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.5px', lineHeight: '1.2' }}>PharosPay</p>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.2' }}>Global Payments</p>
      </div>
    </div>
  );

  return (
    <PaymentProvider wallet={wallet}>
      {/* Loading Screen Overlay */}
      <div className={`loading-screen ${!appLoading ? 'fade-out' : ''}`}>
        <div className="loading-logo-container">
          <img 
            src="/assets/branding/logo.png" 
            alt="Pharos Logo" 
            className="loading-logo" 
          />
          <h1 className="loading-title">PharosPay</h1>
          <p className="loading-subtitle">Global Payments Infrastructure</p>
        </div>
      </div>

      <div className="app-layout">
      {/* Desktop Sidebar */}
      {!isMob && (
        <aside className="sidebar">
          <div style={{ padding: '8px 10px', marginBottom: '24px' }}>
            <Logo />
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: isActive(item.path) ? 'var(--primary-light)' : 'transparent',
                  color: isActive(item.path) ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: isActive(item.path) ? 800 : 600,
                  fontSize: '14px',
                  transition: 'var(--transition)',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <Ic name={item.icon} size={18} color={isActive(item.path) ? 'var(--primary)' : 'var(--text-secondary)'} />
                {item.label}
              </button>
            ))}
          </nav>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', width: '100%', boxSizing: 'border-box' }}>
            <WalletButton wallet={wallet} isSidebar={true} />
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="main-content">
        <AppHeader theme={theme} setTheme={setTheme} wallet={wallet} isMob={isMob} />

        {/* Page Content */}
        <main style={{ minHeight: isMob ? 'calc(100vh - 120px)' : '100vh' }}>
          <Routes>
            <Route path="/" element={<Home wallet={wallet} />} />
            <Route path="/pay" element={<Pay wallet={wallet} />} />
            <Route path="/scan" element={<Scan wallet={wallet} />} />
            <Route path="/history" element={<History wallet={wallet} />} />
            <Route path="/wallet" element={<Wallet wallet={wallet} />} />
            <Route path="/merchant" element={<MerchantDashboard wallet={wallet} />} />
            <Route path="/support" element={
              <ErrorBoundary name="SupportPage">
                <Support wallet={wallet} />
              </ErrorBoundary>
            } />
            <Route path="/verify" element={<VerifyReceipt />} />
            <Route path="/receipt/:paymentId" element={<ReceiptPage />} />
          </Routes>
        </main>
      </div>

      {/* Mobile Sticky Bottom Nav Bar */}
      {isMob && (
        <nav className="mobile-bottom-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="mobile-nav-btn"
              style={{
                color: isActive(item.path) ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive(item.path) ? 800 : 500,
              }}
            >
              <Ic name={item.icon} size={22} color={isActive(item.path) ? 'var(--primary)' : 'var(--text-secondary)'} />
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </div>
    </PaymentProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
