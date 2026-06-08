const crypto = require('crypto');

class ReceiptVerificationService {
  constructor(db, receiptGenerator) {
    this.db = db;
    this.receiptGenerator = receiptGenerator;
  }

  /**
   * Helper to cryptographically sign a receipt object
   */
  sign(receipt) {
    const payload = JSON.stringify({
      paymentId:   receipt.payment.paymentId,
      pharosId:    receipt.payment.pharosPaymentId,
      fiatAmount:  receipt.amounts.fiatAmount,
      fiatCurrency: receipt.amounts.fiatCurrency,
      prosAmount:  receipt.amounts.prosAmount,
      utr:         receipt.settlement.utr,
      createdAt:   receipt.payment.createdAt
    });

    const secret = process.env.RECEIPT_HMAC_SECRET || 'pharospay-secret-hmac';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    
    receipt.meta = receipt.meta || {};
    receipt.meta.signature = signature;
    receipt.meta.signedAt = new Date().toISOString();

    return receipt;
  }

  /**
   * Cryptographic verification using timing-safe comparison
   */
  verify(receipt) {
    if (!receipt || !receipt.payment || !receipt.amounts || !receipt.settlement || !receipt.meta) {
      return { verified: false, reason: 'invalid_receipt_format' };
    }

    try {
      const payload = JSON.stringify({
        paymentId:   receipt.payment.paymentId,
        pharosId:    receipt.payment.pharosPaymentId,
        fiatAmount:  receipt.amounts.fiatAmount,
        fiatCurrency: receipt.amounts.fiatCurrency,
        prosAmount:  receipt.amounts.prosAmount,
        utr:         receipt.settlement.utr,
        createdAt:   receipt.payment.createdAt
      });

      const secret = process.env.RECEIPT_HMAC_SECRET || 'pharospay-secret-hmac';
      const expected = crypto.createHmac('sha256', secret)
                            .update(payload).digest('hex');

      const signature = receipt.meta.signature;
      if (!signature) {
        return { verified: false, reason: 'missing_signature' };
      }

      const sigBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expected, 'hex');

      if (sigBuffer.length !== expectedBuffer.length) {
        return { verified: false, reason: 'signature_mismatch' };
      }

      const verified = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
      return verified ? { verified: true } : { verified: false, reason: 'signature_mismatch' };
    } catch (err) {
      console.error('Receipt verification failed:', err.message);
      return { verified: false, reason: 'verification_error' };
    }
  }

  /**
   * Search for a payment and build a signed verification receipt
   */
  async search(query) {
    if (!query || typeof query !== 'string') {
      return { verified: false, reason: 'empty_query' };
    }

    const trimmed = query.trim();
    let payment = null;

    try {
      if (trimmed.startsWith('RCPT-')) {
        // Look up by reference number
        const res = await this.db.query(
          `SELECT payment_id FROM payment_settlements WHERE reference_number = $1`,
          [trimmed]
        );
        if (res.rows.length > 0) {
          payment = await this.db.payments.findById(res.rows[0].payment_id);
        }
      } else if (trimmed.startsWith('UTR') || trimmed.startsWith('UPI') || trimmed.startsWith('E') || trimmed.length >= 10) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
          // If valid UUID, look up payment directly
          payment = await this.db.payments.findById(trimmed);
        } else if (trimmed.startsWith('0x') && trimmed.length === 42) {
          // It's a wallet address. Return wallet mode instead of single receipt
          const walletRes = await this.db.query(
            `SELECT p.id as payment_id, p.fiat_amount, p.fiat_currency, p.status, p.merchant_identifier, p.created_at
             FROM payments p
             WHERE LOWER(p.user_wallet) = LOWER($1)
             ORDER BY p.created_at DESC LIMIT 20`,
            [trimmed]
          );
          return {
            verified: true,
            type: 'wallet_list',
            payments: walletRes.rows.map(r => ({
              paymentId: r.payment_id,
              amount: `${r.fiat_currency} ${Number(r.fiat_amount).toFixed(2)}`,
              status: r.status,
              merchant: r.merchant_identifier,
              createdAt: r.created_at
            }))
          };
        } else if (trimmed.startsWith('0x') && trimmed.length === 66) {
          // Transaction hash
          const txRes = await this.db.query(
            `SELECT id FROM payments WHERE pharos_confirm_tx = $1 OR pharos_lock_tx = $1`,
            [trimmed]
          );
          if (txRes.rows.length > 0) {
            payment = await this.db.payments.findById(txRes.rows[0].id);
          }
        } else {
          // Look up UTR
          const utrRes = await this.db.query(
            `SELECT payment_id FROM payment_settlements WHERE utr = $1`,
            [trimmed]
          );
          if (utrRes.rows.length > 0) {
            payment = await this.db.payments.findById(utrRes.rows[0].payment_id);
          }
        }
      } else if (trimmed.startsWith('PHAROS-')) {
        // Look up by reference number in settlements
        const res = await this.db.query(
          `SELECT payment_id FROM payment_settlements WHERE reference_number = $1`,
          [trimmed]
        );
        if (res.rows.length > 0) {
          payment = await this.db.payments.findById(res.rows[0].payment_id);
        }
      }

      if (!payment) {
        return { verified: false, reason: 'receipt_not_found' };
      }

      // Load full JSON receipt
      const rawReceipt = await this.receiptGenerator.generateJsonReceipt(payment.id);
      
      // Map to verification payload
      let receipt = {
        payment: {
          paymentId: rawReceipt.paymentId,
          pharosPaymentId: rawReceipt.pharosPaymentId,
          createdAt: rawReceipt.paymentDetails.timestamp
        },
        amounts: {
          fiatAmount: rawReceipt.paymentDetails.fiatAmount,
          fiatCurrency: rawReceipt.paymentDetails.fiatCurrency,
          prosAmount: rawReceipt.paymentDetails.prosAmount
        },
        settlement: {
          utr: rawReceipt.utr,
          referenceNumber: rawReceipt.referenceNumber,
          settledAt: rawReceipt.settlementInfo ? rawReceipt.settlementInfo.settledAt : null
        },
        meta: {
          signature: '',
          viewCount: 0
        }
      };

      // Sign receipt
      receipt = this.sign(receipt);

      const verification = this.verify(receipt);

      return {
        verified: verification.verified,
        reason: verification.reason || null,
        receipt,
        payment: rawReceipt
      };

    } catch (err) {
      console.error('Receipt search failed:', err.message);
      return { verified: false, reason: 'search_error' };
    }
  }
}

module.exports = ReceiptVerificationService;
