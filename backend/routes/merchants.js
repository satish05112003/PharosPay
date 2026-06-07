const express = require('express');
const router = express.Router();
const { getMerchant, saveMerchant, getAllMerchants } = require('../lib/merchantsDb');
const { getSettlements } = require('../lib/settlementSim');

/**
 * GET /api/merchants
 * Get all merchants (for testing/debugging list)
 */
router.get('/merchants', (req, res) => {
  try {
    const list = getAllMerchants();
    res.json({ success: true, merchants: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/merchants/:merchantId
 * Get a specific merchant profile (scanned or loaded)
 */
router.get('/merchants/:merchantId', (req, res) => {
  try {
    const { merchantId } = req.params;
    const profile = getMerchant(merchantId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: `Merchant profile not found for ID: ${merchantId}`
      });
    }

    res.json({
      success: true,
      merchant: profile
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchants
 * Register/Onboard a new merchant profile
 */
router.post('/merchants', (req, res) => {
  try {
    const {
      merchantId,
      businessName,
      country,
      supportedRails,
      upiId,
      bankAccountMasked,
      ifscMasked,
      pixKey,
      payNowId,
      achAccountMasked,
      logoUrl,
      settlementSpeed
    } = req.body;

    if (!merchantId || !businessName || !country) {
      return res.status(400).json({
        success: false,
        error: 'Missing required profile fields: merchantId, businessName, country'
      });
    }

    // Check if merchant already exists
    const existing = getMerchant(merchantId);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Merchant ID "${merchantId}" is already taken`
      });
    }

    const newProfile = {
      merchantId,
      businessName,
      country,
      supportedRails: supportedRails || [],
      upiId: upiId || '',
      bankAccountMasked: bankAccountMasked || '',
      ifscMasked: ifscMasked || '',
      pixKey: pixKey || '',
      payNowId: payNowId || '',
      achAccountMasked: achAccountMasked || '',
      logoUrl: logoUrl || 'https://images.unsplash.com/photo-1599305445671-ec2c6c34a425?w=100&auto=format&fit=crop&q=60',
      kycStatus: 'APPROVED', // Auto KYC Approved for verification flow
      settlementSpeed: settlementSpeed || 'Instant',
      beneficiaryId: `BEN_${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      teamMembers: ['owner@' + merchantId.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com']
    };

    saveMerchant(merchantId, newProfile);

    res.status(201).json({
      success: true,
      merchant: newProfile
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/merchants/:merchantId
 * Update payout account fields for a merchant
 */
router.put('/merchants/:merchantId', (req, res) => {
  try {
    const { merchantId } = req.params;
    const profile = getMerchant(merchantId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Merchant profile not found'
      });
    }

    const updated = {
      ...profile,
      ...req.body,
      merchantId // Keep ID locked
    };

    saveMerchant(merchantId, updated);

    res.json({
      success: true,
      merchant: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/merchants/:merchantId/settlements
 * Get settlement logs and UTRs associated with a merchant
 */
router.get('/merchants/:merchantId/settlements', (req, res) => {
  try {
    const { merchantId } = req.params;
    const allSettlements = getSettlements();
    
    // Filter settlements where merchantId matches, or matching by payout destination
    const filtered = allSettlements.filter(s => 
      s.merchantId === merchantId || 
      (s.merchantName && s.merchantName.toLowerCase() === merchantId.toLowerCase())
    );

    res.json({
      success: true,
      settlements: filtered,
      count: filtered.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchants/:merchantId/team
 * Add team member to merchant profile
 */
router.post('/merchants/:merchantId/team', (req, res) => {
  try {
    const { merchantId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email parameter is required' });
    }

    const profile = getMerchant(merchantId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Merchant profile not found' });
    }

    if (!profile.teamMembers) {
      profile.teamMembers = [];
    }

    if (profile.teamMembers.includes(email)) {
      return res.status(400).json({ success: false, error: 'Member already exists in team' });
    }

    profile.teamMembers.push(email);
    saveMerchant(merchantId, profile);

    res.json({
      success: true,
      teamMembers: profile.teamMembers
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/merchants/:merchantId/team/:email
 * Remove team member from merchant profile
 */
router.delete('/merchants/:merchantId/team/:email', (req, res) => {
  try {
    const { merchantId, email } = req.params;

    const profile = getMerchant(merchantId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Merchant profile not found' });
    }

    if (!profile.teamMembers) {
      profile.teamMembers = [];
    }

    profile.teamMembers = profile.teamMembers.filter(m => m !== email);
    saveMerchant(merchantId, profile);

    res.json({
      success: true,
      teamMembers: profile.teamMembers
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
