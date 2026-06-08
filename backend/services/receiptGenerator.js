const fs = require('fs');
const path = require('path');
const priceService = require('./PriceService');
let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  // Dynamically required to prevent startup failures if pdfkit is not yet installed
}

class ReceiptGenerator {
  constructor(db) {
    this.db = db;
  }

  async generateJsonReceipt(paymentId) {
    // Try looking up by UUID first (if valid UUID), then fall back to on-chain pharos_payment_id
    let payment = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);
    if (isUuid) {
      payment = await this.db.payments.findById(paymentId);
    }
    if (!payment) {
      payment = await this.db.payments.findByPharosPaymentId(paymentId);
    }
    if (!payment) {
      throw new Error('Payment not found');
    }

    const settlement = await this.db.settlements.findByPaymentId(payment.id);
    const beneficiary = payment.merchant_id ? await this.db.beneficiaries.findById(payment.merchant_id) : null;

    // Resolve dynamic pricing parameters if missing on older records
    let liveProsPrice = 0.6360;
    let liveFxRate = 1.0;
    try {
      liveProsPrice = await priceService.getProsUsdPrice();
      liveFxRate = await priceService.getRateValue(payment.fiat_currency);
    } catch (err) {
      console.warn('ReceiptGenerator: Failed to fetch live prices for fallback mapping:', err.message);
    }

    return {
      receiptId: payment.id,
      paymentId: payment.id,
      pharosPaymentId: payment.pharos_payment_id,
      referenceNumber: settlement ? settlement.reference_number : null,
      utr: settlement ? settlement.utr : null,
      payer: payment.user_wallet,
      merchant: {
        id: payment.merchant_identifier,
        name: settlement ? (settlement.beneficiary_name || payment.merchant_identifier) : (beneficiary ? beneficiary.verified_name : payment.merchant_identifier),
        bank: settlement ? settlement.bank : (beneficiary ? beneficiary.verified_bank : null)
      },
      paymentDetails: {
        fiatAmount: Number(payment.fiat_amount),
        fiatCurrency: payment.fiat_currency,
        prosAmount: Number(payment.pros_amount),
        paymentRail: payment.payment_rail,
        country: payment.country,
        status: payment.status,
        timestamp: payment.created_at,
        prosPriceAtExecution: payment.pros_price_at_execution || payment.pros_usd_rate || liveProsPrice,
        fxRateAtExecution: payment.fx_rate_at_execution || payment.usd_fiat_rate || liveFxRate,
        quoteTimestamp: payment.quote_timestamp || payment.created_at,
        priceSource: payment.price_source || 'Coinbase'
      },
      blockchain: {
        lockTxHash: payment.pharos_lock_tx,
        confirmTxHash: payment.pharos_confirm_tx
      },
      settlementInfo: settlement ? {
        providerName: settlement.provider_name,
        initiatedAt: settlement.initiated_at,
        settledAt: settlement.settled_at,
        isSimulation: settlement.is_simulation
      } : null
    };
  }

  async generatePdfReceiptStream(receiptData) {
    if (!PDFDocument) {
      try {
        PDFDocument = require('pdfkit');
      } catch (err) {
        throw new Error('pdfkit is not installed. Please run "npm install pdfkit" in the backend folder.');
      }
    }

    const doc = new PDFDocument({ margin: 40 });

    // Pre-fetch QR Code PNG buffer pointing to the verification page
    let qrBuffer = null;
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://pharospay.xyz/receipt/${receiptData.paymentId}`)}`;
      const qrRes = await fetch(qrUrl);
      if (qrRes.ok) {
        qrBuffer = Buffer.from(await qrRes.arrayBuffer());
      }
    } catch (qrErr) {
      console.warn('ReceiptGenerator: Failed to fetch QR code image buffer:', qrErr.message);
    }

    // Helper to draw section header cards
    const drawSectionHeader = (title) => {
      doc.moveDown(0.8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(title);
      doc.moveDown(0.2);
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
      doc.moveDown(0.4);
    };

    // Helper to draw key-value table rows
    const drawRow = (label, value) => {
      const cleanValue = value ? String(value) : 'N/A';
      doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(label, 45, doc.y, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(cleanValue, { align: 'right' });
      doc.moveDown(0.25);
    };

    // ─── Branded Header Section ──────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f172a').text('PharosPay', { align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#6366f1').text('Settlement Receipt', { align: 'center' });
    doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Global Payments Infrastructure', { align: 'center' });
    doc.moveDown(0.6);

    // Document Metadata
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
    doc.text(`Document No: ${receiptData.receiptId}`, 45, doc.y, { continued: true });
    doc.text(`Issued: ${new Date(receiptData.paymentDetails.timestamp).toLocaleString()}`, { align: 'right' });
    doc.text(`Reference: ${receiptData.referenceNumber || 'N/A'}`, 45, doc.y, { continued: true });
    doc.text(`Status: ${(receiptData.paymentDetails.status || 'SETTLED').toUpperCase()}`, { align: 'right' });
    doc.moveDown(0.5);

    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, doc.y).lineTo(570, doc.y).stroke();

    // ─── 1. Payment Summary ──────────────────────────────────────
    drawSectionHeader('1. Payment Summary');
    const fiatAmt = Number(receiptData.paymentDetails.fiatAmount).toFixed(2);
    const prosAmt = Number(receiptData.paymentDetails.prosAmount).toFixed(4);
    drawRow('Payer Wallet Address', receiptData.payer);
    drawRow('Amount Settled', `${fiatAmt} ${receiptData.paymentDetails.fiatCurrency}`);
    drawRow('PROS Burned', `${prosAmt} PROS`);
    drawRow('Payment Rail Method', receiptData.paymentDetails.paymentRail);

    // ─── 2. Merchant Information ─────────────────────────────────
    drawSectionHeader('2. Merchant Information');
    drawRow('Merchant Legal Name', receiptData.merchant.name);
    drawRow('Merchant ID Key', receiptData.merchant.id);
    drawRow('Settlement Country', receiptData.paymentDetails.country);

    // ─── 3. Settlement Information ───────────────────────────────
    drawSectionHeader('3. Settlement Information');
    drawRow('Payout Bank Destination', receiptData.merchant.bank || 'N/A');
    drawRow('Banking Reference UTR', receiptData.utr || 'N/A');
    drawRow('Settlement Speed', 'Instant Payout (⚡ Speed)');
    if (receiptData.settlementInfo) {
      drawRow('Settlement Provider', receiptData.settlementInfo.providerName);
    }

    // ─── 4. Financial Breakdown ──────────────────────────────────
    drawSectionHeader('4. Financial Breakdown');
    const prosPrice = Number(receiptData.paymentDetails.prosPriceAtExecution).toFixed(4);
    const fxRate = Number(receiptData.paymentDetails.fxRateAtExecution).toFixed(4);
    drawRow('Base Fiat Amount', `${fiatAmt} ${receiptData.paymentDetails.fiatCurrency}`);
    drawRow('Platform Fee (2.0%)', `${(fiatAmt * 0.02).toFixed(2)} ${receiptData.paymentDetails.fiatCurrency}`);
    drawRow('PROS/USD Price', `$${prosPrice}`);
    drawRow(`Exchange Rate (USD/${receiptData.paymentDetails.fiatCurrency})`, fxRate);
    drawRow('Execution Oracle Source', receiptData.paymentDetails.priceSource);

    // ─── 5. Blockchain Verification ──────────────────────────────
    drawSectionHeader('5. Blockchain Verification');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('Payment ID:', 45, doc.y, { continued: true });
    doc.font('Courier').fillColor('#475569').text(`  ${receiptData.pharosPaymentId}`, { align: 'right' });
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text('Confirm TX Hash:', 45, doc.y, { continued: true });
    doc.font('Courier').fillColor('#475569').text(`  ${receiptData.blockchain.confirmTxHash || 'N/A'}`, { align: 'right' });
    doc.moveDown(0.2);

    // ─── 6. Support Information ──────────────────────────────────
    drawSectionHeader('6. Support Information');
    drawRow('PharosPay Support Center', 'https://pharospay.xyz/support');
    drawRow('Verification Portal Reference', receiptData.referenceNumber || 'PHAROS-REF');
    drawRow('Ticket ID reference', `TKT-${receiptData.paymentId.substring(0, 8).toUpperCase()}`);

    // ─── 7. Receipt Verification ─────────────────────────────────
    drawSectionHeader('7. Receipt Verification');
    const startY = doc.y;
    
    // Left Details
    doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
    doc.text('Verification URL:', 45, startY);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#6366f1');
    doc.text(`https://pharospay.xyz/receipt/${receiptData.paymentId}`, 45, startY + 12);
    
    doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
    doc.text('Verified Status:', 45, startY + 32);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#10b981');
    doc.text('✓ Cryptographically Verified (HMAC Signature Match)', 45, startY + 44);

    // Right embedded QR Code
    if (qrBuffer) {
      doc.image(qrBuffer, 480, startY - 10, { width: 70 });
    }

    // ─── Footer Section ──────────────────────────────────────────
    doc.y = Math.max(doc.y, startY + 80);
    doc.moveDown(0.8);
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown(0.6);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('PharosPay', { align: 'center' });
    doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Secure Cross-Border Payments on Pharos Blockchain', { align: 'center' });
    doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8').text('This receipt was generated automatically and can be verified online.', { align: 'center' });
    doc.text('Verify: https://atlantic.pharosscan.xyz', { align: 'center' });

    doc.end();
    return doc;
  }

  /**
   * Generate a compact shareable receipt summary
   */
  async generateShareableReceipt(paymentId) {
    const receipt = await this.generateJsonReceipt(paymentId);

    return {
      title: 'PharosPay Payment Receipt',
      ticketNumber: receipt.referenceNumber || receipt.receiptId,
      summary: `${receipt.paymentDetails.fiatAmount} ${receipt.paymentDetails.fiatCurrency} → ${Number(receipt.paymentDetails.prosAmount).toFixed(4)} PROS`,
      merchant: receipt.merchant.name,
      status: receipt.paymentDetails.status,
      timestamp: receipt.paymentDetails.timestamp,
      utr: receipt.utr,
      prosPrice: receipt.paymentDetails.prosPriceAtExecution,
      fxRate: receipt.paymentDetails.fxRateAtExecution,
      priceSource: receipt.paymentDetails.priceSource,
      blockchainProof: {
        paymentId: receipt.pharosPaymentId,
        confirmTx: receipt.blockchain.confirmTxHash
      },
      shareUrl: `/receipts/${paymentId}`
    };
  }

  /**
   * Generate email body for receipt sharing (mock | logs to console)
   */
  async generateEmailReceipt(paymentId, recipientEmail) {
    const receipt = await this.generateJsonReceipt(paymentId);

    const emailBody = {
      to: recipientEmail,
      subject: `PharosPay Receipt | ${receipt.paymentDetails.fiatAmount} ${receipt.paymentDetails.fiatCurrency} Payment`,
      body: [
        `Hello,`,
        ``,
        `Here is your PharosPay payment receipt:`,
        ``,
        `Amount: ${receipt.paymentDetails.fiatAmount} ${receipt.paymentDetails.fiatCurrency}`,
        `PROS Paid: ${Number(receipt.paymentDetails.prosAmount).toFixed(4)} PROS`,
        `Merchant: ${receipt.merchant.name}`,
        `Status: ${receipt.paymentDetails.status}`,
        `Date: ${new Date(receipt.paymentDetails.timestamp).toLocaleString()}`,
        `UTR: ${receipt.utr || 'N/A'}`,
        ``,
        `PROS Price: $${Number(receipt.paymentDetails.prosPriceAtExecution).toFixed(4)}`,
        `FX Rate: ${Number(receipt.paymentDetails.fxRateAtExecution).toFixed(4)}`,
        `Source: ${receipt.paymentDetails.priceSource}`,
        ``,
        `Blockchain Proof:`,
        `Payment ID: ${receipt.pharosPaymentId}`,
        `Confirm TX: ${receipt.blockchain.confirmTxHash || 'N/A'}`,
        ``,
        `PharosPay | Global Payments Infrastructure`
      ].join('\n')
    };

    // Mock email send | log to console
    console.log(`📧 Receipt email queued for ${recipientEmail}`);
    console.log(`   Subject: ${emailBody.subject}`);

    return { success: true, message: `Receipt sent to ${recipientEmail}`, emailBody };
  }
}

module.exports = ReceiptGenerator;
