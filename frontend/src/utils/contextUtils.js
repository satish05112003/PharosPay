/**
 * Formats context structures for admin/client previews
 */
export const formatShortWallet = (wallet) => {
  if (!wallet || wallet.length < 10) return wallet || '';
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

export const formatContextSummary = (context = {}) => {
  const pending = context.pendingPayments?.length || 0;
  const failed = context.failedPayments?.length || 0;
  const open = context.openTickets?.length || 0;

  return {
    badgeText: `${pending} Pending • ${failed} Failed • ${open} Tickets`,
    isClean: pending === 0 && failed === 0 && open === 0
  };
};

export const parseIsoDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
