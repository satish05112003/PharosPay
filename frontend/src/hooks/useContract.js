import { useMemo } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, ABI } from '../config';

/**
 * useContract | Returns ethers.Contract instances for PharosPay contracts.
 * Provides both read-only (provider) and write (signer) contract instances.
 */
export function useContract(provider, signer) {
  const contracts = useMemo(() => {
    if (!provider) return null;

    const readContracts = {};
    const writeContracts = {};

    for (const [name, address] of Object.entries(CONTRACTS)) {
      if (!address || !ABI[name]) continue;
      readContracts[name] = new ethers.Contract(address, ABI[name], provider);
      if (signer) {
        writeContracts[name] = new ethers.Contract(address, ABI[name], signer);
      }
    }

    return { read: readContracts, write: writeContracts };
  }, [provider, signer]);

  return contracts;
}

/**
 * Helper: Format token amount for display
 */
export function formatTokenAmount(weiAmount) {
  if (!weiAmount) return '0';
  return parseFloat(ethers.formatEther(weiAmount)).toFixed(4);
}

/**
 * Helper: Parse fiat amount to 18-decimal BigInt
 */
export function parseFiatAmount(amount) {
  return ethers.parseEther(amount.toString());
}

/**
 * Helper: Truncate address for display
 */
export function truncateAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Helper: Get explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash) {
  return `https://atlantic.pharosscan.xyz/tx/${txHash}`;
}

/**
 * Helper: Get explorer URL for an address
 */
export function getExplorerAddressUrl(address) {
  return `https://atlantic.pharosscan.xyz/address/${address}`;
}
