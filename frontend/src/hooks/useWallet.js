import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { PHAROS_CHAIN, CONTRACTS, ABI } from '../config';

/**
 * useWallet — Robust MetaMask wallet connector hook for Pharos Atlantic Testnet.
 * Safely handles: connect, disconnect, re-initializing provider/signer on chainChange,
 * and blocking state management during switches.
 */
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [phrsBalance, setPhrsBalance] = useState('0');
  const [prosBalance, setProsBalance] = useState('0');
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [error, setError] = useState(null);

  const isConnected = !!address;
  const isCorrectNetwork = chainId === PHAROS_CHAIN.chainIdDecimal;

  // ─── Fetch balances helper ─────────────────────────────────────────────
  const fetchBalances = useCallback(async (addr, prov) => {
    if (!addr || !prov) return;
    try {
      const nativeBal = await prov.getBalance(addr);
      setPhrsBalance(parseFloat(ethers.formatEther(nativeBal)).toFixed(4));

      if (CONTRACTS.MockPROS) {
        const pros = new ethers.Contract(CONTRACTS.MockPROS, ABI.MockPROS, prov);
        const prosBal = await pros.balanceOf(addr);
        setProsBalance(parseFloat(ethers.formatEther(prosBal)).toFixed(4));
      }
    } catch (e) {
      console.warn('Balance check error:', e.message);
    }
  }, []);

  // ─── Safely switch/add network in MetaMask ──────────────────────────────
  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    setIsSwitchingNetwork(true);
    setError(null);
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: PHAROS_CHAIN.chainId }],
      });
      setIsSwitchingNetwork(false);
    } catch (switchError) {
      // 4902 is the error code for "chain has not been added to MetaMask"
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: PHAROS_CHAIN.chainId,
              chainName: PHAROS_CHAIN.chainName,
              nativeCurrency: PHAROS_CHAIN.nativeCurrency,
              rpcUrls: PHAROS_CHAIN.rpcUrls,
              blockExplorerUrls: PHAROS_CHAIN.blockExplorerUrls,
            }],
          });
          setIsSwitchingNetwork(false);
        } catch (addError) {
          setError(addError.message || 'Failed to add Pharos Network');
          setIsSwitchingNetwork(false);
        }
      } else {
        setError(switchError.message || 'Failed to switch network');
        setIsSwitchingNetwork(false);
      }
    }
  }, []);

  // ─── Reinitialize Signer & Provider ────────────────────────────────────
  const initSigner = useCallback(async (prov, addr) => {
    try {
      const sign = await prov.getSigner();
      setSigner(sign);
      if (addr) await fetchBalances(addr, prov);
    } catch (e) {
      console.warn("Could not load signer:", e);
      setSigner(null);
    }
  }, [fetchBalances]);

  // ─── Connect Wallet ────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const prov = new ethers.BrowserProvider(window.ethereum);
      const network = await prov.getNetwork();
      const currentChainId = Number(network.chainId);

      setProvider(prov);
      setAddress(accounts[0]);
      setChainId(currentChainId);

      // Save connection preference
      localStorage.setItem('pharos_wallet_connected', 'true');

      if (currentChainId !== PHAROS_CHAIN.chainIdDecimal) {
        setIsSwitchingNetwork(true);
        await switchNetwork();
      } else {
        await initSigner(prov, accounts[0]);
      }
    } catch (e) {
      setError(e.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [switchNetwork, initSigner]);

  // ─── Disconnect ────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setPhrsBalance('0');
    setProsBalance('0');
    setChainId(null);
    setIsSwitchingNetwork(false);
    localStorage.removeItem('pharos_wallet_connected');
  }, []);

  const refreshBalances = useCallback(() => {
    if (address && provider) {
      fetchBalances(address, provider);
    }
  }, [address, provider, fetchBalances]);

  // ─── Watch Ethereum Events ─────────────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAddress(accounts[0]);
        if (provider) {
          await initSigner(provider, accounts[0]);
        }
      }
    };

    const handleChainChanged = async (newChainIdHex) => {
      const newChainId = parseInt(newChainIdHex, 16);
      setChainId(newChainId);
      
      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);

      if (newChainId === PHAROS_CHAIN.chainIdDecimal) {
        setIsSwitchingNetwork(false);
        if (address) {
          await initSigner(prov, address);
        }
      } else {
        setIsSwitchingNetwork(true);
        setSigner(null);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [address, provider, disconnect, initSigner]);

  // ─── Auto-connect if previously allowed ─────────────────────────────────
  useEffect(() => {
    if (window.ethereum) {
      const wasConnected = localStorage.getItem('pharos_wallet_connected');
      if (wasConnected === 'true') {
        window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
          if (accounts.length > 0) {
            connect();
          }
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    address,
    provider,
    signer,
    phrsBalance,
    prosBalance,
    chainId,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    isSwitchingNetwork,
    error,
    connect,
    disconnect,
    switchNetwork,
    refreshBalances,
  };
}
