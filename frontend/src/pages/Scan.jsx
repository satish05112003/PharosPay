import React from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from '../components/QRScanner';

export default function Scan({ wallet }) {
  const navigate = useNavigate();

  const handleScanSuccess = (merchantData) => {
    // Navigate to payment page and pass pre-populated merchant details
    navigate('/pay', { state: { scannedMerchant: merchantData } });
  };

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Scan QR Code</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Point camera at a merchant QR code or upload a QR image.
        </p>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <QRScanner onScanSuccess={handleScanSuccess} />
      </div>
    </div>
  );
}
