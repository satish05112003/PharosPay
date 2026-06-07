import { Link, useLocation } from 'react-router-dom';
import WalletButton from './WalletButton';

export default function Navbar({ wallet }) {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <div className="logo-icon">⬡</div>
        <h1>PharosPay</h1>
      </div>
      <div className="navbar-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
        <Link to="/pay" className={location.pathname === '/pay' ? 'active' : ''}>Pay</Link>
        <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>History</Link>
      </div>
      <WalletButton wallet={wallet} />
    </nav>
  );
}
