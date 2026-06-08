const express = require('express');
const router = express.Router();

module.exports = (receiptGenerator) => {
  // GET /api/receipts/:paymentId/json
  router.get('/:paymentId/json', async (req, res) => {
    try {
      const { paymentId } = req.params;
      const receipt = await receiptGenerator.generateJsonReceipt(paymentId);
      res.json({ success: true, receipt });
    } catch (err) {
      console.error('Failed to generate JSON receipt:', err.message);
      res.status(404).json({ success: false, error: err.message });
    }
  });

  // GET /api/receipts/:paymentId/pdf
  router.get('/:paymentId/pdf', async (req, res) => {
    try {
      const { paymentId } = req.params;
      const receiptData = await receiptGenerator.generateJsonReceipt(paymentId);
      const doc = await receiptGenerator.generatePdfReceiptStream(receiptData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt-${receiptData.referenceNumber || paymentId}.pdf`);
      
      doc.pipe(res);
    } catch (err) {
      console.error('Failed to generate PDF receipt:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/receipts/:paymentId/share
  // Returns a compact shareable receipt summary
  router.get('/:paymentId/share', async (req, res) => {
    try {
      const { paymentId } = req.params;
      const shareData = await receiptGenerator.generateShareableReceipt(paymentId);
      res.json({ success: true, receipt: shareData });
    } catch (err) {
      console.error('Failed to generate shareable receipt:', err.message);
      res.status(404).json({ success: false, error: err.message });
    }
  });

  // POST /api/receipts/:paymentId/email
  // Send receipt via email (mock | logs to console)
  router.post('/:paymentId/email', async (req, res) => {
    try {
      const { paymentId } = req.params;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email address is required' });
      }

      const result = await receiptGenerator.generateEmailReceipt(paymentId, email);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('Failed to send receipt email:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
