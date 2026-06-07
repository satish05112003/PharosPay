const express = require('express');
const router = express.Router();
const { parseQR } = require('../lib/qrParser');

/**
 * POST /api/parse-qr
 * Parse a QR code string and extract structured payment data.
 * 
 * Body: { qrData: "upi://pay?pa=merchant@bank&pn=Name&am=100&cu=INR" }
 * Response: { success: true, data: { merchantId, merchantName, amount, currency, ... } }
 */
router.post('/parse-qr', (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        error: 'Missing qrData in request body',
      });
    }

    const parsed = parseQR(qrData);

    res.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
