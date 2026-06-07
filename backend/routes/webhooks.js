const express = require('express');
const router = express.Router();

module.exports = (webhookProcessor) => {
  // POST /webhooks/:provider
  // e.g. /webhooks/razorpayx, /webhooks/cashfree, /webhooks/simulation
  router.post('/:provider', express.raw({ type: '*/*' }), async (req, res) => {
    const { provider } = req.params;
    
    try {
      const rawBody = req.body;
      const headers = req.headers;
      
      await webhookProcessor.processWebhook(provider, rawBody, headers);
      res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (err) {
      console.error(`Webhook Router Error [${provider}]:`, err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
};
