const express = require('express');
const router = express.Router();
const networkConfigService = require('../services/NetworkConfigService');

// ─── GET /api/config/network ─────────────────────────────────────────────
router.get('/network', (req, res) => {
  try {
    const config = networkConfigService.getActiveConfig();
    const paymentToken = networkConfigService.getPaymentToken();

    res.json({
      success: true,
      network: {
        name: config.networkName,
        chainId: config.chainId,
        explorerUrl: config.explorerUrl,
        rpcUrl: config.rpcUrl,
        tokenSymbol: config.tokenSymbol,
        tokenName: config.tokenName
      },
      payment: {
        tokenSymbol: paymentToken.symbol,
        tokenAddress: paymentToken.address
      }
    });
  } catch (err) {
    console.error('Failed to get network config:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
