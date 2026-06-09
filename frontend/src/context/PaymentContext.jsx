import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { API_BASE, CONTRACTS, ABI } from '../config';
import { formatPROS } from '../hooks/useContract';

const PaymentContext = createContext();

export function usePayments() {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayments must be used within a PaymentProvider');
  }
  return context;
}

export function PaymentProvider({ children, wallet }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [globalStats, setGlobalStats] = useState({ paymentCount: 0, volume: '0', feeRate: 200 });
  const [userPaymentCount, setUserPaymentCount] = useState(0);
  
  const retryCountRef = useRef(0);

  const fetchPayments = useCallback(async () => {
    // If wallet isn't connected or loaded yet, reset lists
    if (!wallet || !wallet.isConnected || !wallet.address) {
      setPayments([]);
      setUserPaymentCount(0);
      return;
    }

    setLoading(true);
    setError(null);

    let fetchedFromBackend = false;
    let backendData = [];

    // 1. Try fetching from Backend History API first (Priority)
    try {
      const res = await fetch(`${API_BASE}/payments/history?payer=${wallet.address}`);
      const data = await res.json();
      
      console.log('PaymentContext [Debug]: historyAPIResult', data);
      
      if (data.success && Array.isArray(data.payments)) {
        backendData = data.payments.map(p => ({
          ...p,
          timestamp: new Date(p.timestamp),
          fiatAmount: parseFloat(p.fiatAmount),
        }));
        fetchedFromBackend = true;
      }
    } catch (err) {
      console.warn('PaymentContext [Debug]: Failed to fetch from backend API. Falling back to contract.', err);
    }

    // 2. Fetch from Router Contract
    try {
      if (wallet.provider && CONTRACTS.PharosPayRouter) {
        const router = new ethers.Contract(CONTRACTS.PharosPayRouter, ABI.PharosPayRouter, wallet.provider);
        
        // Fetch global stats
        const [count, volume, feeRate] = await Promise.all([
          router.paymentCount(),
          router.totalVolumeProcessed(),
          router.feeRateBps(),
        ]);
        
        const currentGlobalCount = Number(count);
        const gStats = {
          paymentCount: currentGlobalCount,
          volume: formatPROS(volume),
          feeRate: Number(feeRate),
        };
        setGlobalStats(gStats);
        
        const [userCount, paymentIds] = await Promise.all([
          router.getUserPaymentCount(wallet.address),
          router.getUserPayments(wallet.address),
        ]);
        
        const currentUserCount = Number(userCount);
        setUserPaymentCount(currentUserCount);

        console.log('PaymentContext [Debug]: paymentCount (Global)', currentGlobalCount);
        console.log('PaymentContext [Debug]: userPayments (Contract Count)', currentUserCount);
        
        let finalPayments = [];

        // If backend failed or has fewer entries than contract, load directly from blockchain events/history
        if (!fetchedFromBackend || backendData.length < paymentIds.length) {
          console.log(`PaymentContext [Debug]: Contract reports ${paymentIds.length} payments; backend has ${backendData.length}. Querying contract detail tuples...`);
          const paymentPromises = paymentIds.map(async (id) => {
            const p = await router.getPayment(id);
            const matchedBackend = backendData.find(bp => bp.pharosPaymentId === p.id || bp.id === p.id);
            return {
              id: p.id,
              merchantId: p.merchantId,
              merchantName: p.merchantName,
              fiatCurrency: p.fiatCurrency,
              fiatAmount: parseFloat(ethers.formatEther(p.fiatAmount)),
              prosAmount: formatPROS(p.prosAmount),
              feeAmount: matchedBackend?.feeAmount || formatPROS(p.feeAmount),
              paymentRail: p.paymentRail,
              country: p.country,
              timestamp: new Date(Number(p.timestamp) * 1000),
              status: ['PENDING', 'SETTLED', 'FAILED'][p.status],
              prosPriceAtExecution: matchedBackend ? matchedBackend.prosPriceAtExecution : null,
              fxRateAtExecution: matchedBackend ? matchedBackend.fxRateAtExecution : null,
              priceSource: matchedBackend ? matchedBackend.priceSource : null,
              quoteTimestamp: matchedBackend ? matchedBackend.quoteTimestamp : null
            };
          });
          finalPayments = await Promise.all(paymentPromises);
        } else {
          finalPayments = backendData;
        }

        // Sort newest first
        finalPayments.sort((a, b) => b.timestamp - a.timestamp);
        setPayments(finalPayments);
        console.log('PaymentContext [Debug]: recentPayments (Resolved)', finalPayments);

        // Validation rule: If global payments exist and user payments lists are empty, but retry is allowed, retry once
        if (currentGlobalCount > 0 && finalPayments.length === 0 && retryCountRef.current < 2) {
          retryCountRef.current += 1;
          console.warn(`PaymentContext [Debug]: Global payments (${currentGlobalCount}) > 0 but user payments is 0. Force refetching (Attempt ${retryCountRef.current})...`);
          setTimeout(() => {
            fetchPayments();
          }, 800);
        } else {
          // Reset retry count when resolved
          retryCountRef.current = 0;
        }
      }
    } catch (err) {
      console.error('PaymentContext [Debug]: Smart Contract query error:', err);
      setError(err.message || 'Failed to fetch payments data');
      
      // Fallback to backend list if contract fails
      if (fetchedFromBackend) {
        backendData.sort((a, b) => b.timestamp - a.timestamp);
        setPayments(backendData);
        setUserPaymentCount(backendData.length);
      }
    } finally {
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address, wallet.provider]);

  // Fetch payments on load or when wallet attributes change
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const refreshPayments = useCallback(() => {
    retryCountRef.current = 0; // reset retry limit on manual refresh
    return fetchPayments();
  }, [fetchPayments]);

  return (
    <PaymentContext.Provider value={{
      payments,
      loading,
      error,
      globalStats,
      userPaymentCount,
      refreshPayments
    }}>
      {children}
    </PaymentContext.Provider>
  );
}
