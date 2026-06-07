const fs = require('fs');
const path = require('path');
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
        prosPriceAtExecution: payment.pros_price_at_execution || payment.pros_usd_rate || '0.214',
        fxRateAtExecution: payment.fx_rate_at_execution || payment.usd_fiat_rate || '1.0',
        quoteTimestamp: payment.quote_timestamp || payment.created_at,
        priceSource: payment.price_source || 'PharosOracle'
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
      // Try requiring again in case it was installed since startup
      try {
        PDFDocument = require('pdfkit');
      } catch (err) {
        throw new Error('pdfkit is not installed. Please run "npm install pdfkit" in the backend folder.');
      }
    }

    const doc = new PDFDocument({ margin: 50 });

    // Title
    doc.fontSize(20).text('PHAROSPAY SETTLEMENT RECEIPT', { align: 'center' });
    doc.moveDown();

    // Meta metadata
    doc.fontSize(10).text(`Receipt ID: ${receiptData.receiptId}`);
    doc.text(`Reference No: ${receiptData.referenceNumber || 'N/A'}`);
    doc.text(`Date: ${new Date(receiptData.paymentDetails.timestamp).toLocaleString()}`);
    doc.moveDown();

    // Divider line
    doc.strokeColor('#cccccc').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Section: Payout Details
    doc.fontSize(14).text('Payment Overview', { underline: true });
    doc.fontSize(11);
    doc.text(`Payer Wallet: ${receiptData.payer}`);
    doc.text(`Merchant Name: ${receiptData.merchant.name}`);
    doc.text(`Merchant Rail ID: ${receiptData.merchant.id} (${receiptData.paymentDetails.paymentRail})`);
    doc.text(`Settlement Bank: ${receiptData.merchant.bank || 'N/A'}`);
    doc.moveDown();

    // Section: Financial Breakdown
    doc.fontSize(14).text('Amounts & Rates', { underline: true });
    doc.fontSize(11);
    doc.text(`Total Settled: ${receiptData.paymentDetails.fiatAmount} ${receiptData.paymentDetails.fiatCurrency}`);
    doc.text(`Crypto Amount: ${receiptData.paymentDetails.prosAmount} PROS`);
    doc.text(`PROS Price: $${Number(receiptData.paymentDetails.prosPriceAtExecution).toFixed(4)}`);
    doc.text(`FX Rate: 1 USD = ${Number(receiptData.paymentDetails.fxRateAtExecution).toFixed(4)} ${receiptData.paymentDetails.fiatCurrency}`);
    doc.text(`Price Source: ${receiptData.paymentDetails.priceSource}`);
    doc.text(`Settlement UTR: ${receiptData.utr || 'N/A'}`);
    doc.moveDown();

    // Section: Blockchain Proof
    doc.fontSize(14).text('Blockchain Proof', { underline: true });
    doc.fontSize(10);
    doc.text(`On-Chain Payment ID: ${receiptData.pharosPaymentId}`);
    doc.text(`On-Chain Confirm TX: ${receiptData.blockchain.confirmTxHash || 'N/A'}`);
    doc.moveDown();

    // Divider line
    doc.strokeColor('#cccccc').moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(9).text('PharosPay Settlement Engine — Secure Cross-Border Payments on Pharos Blockchain.', { align: 'center', color: '#666666' });

    doc.end();
    return doc;
  }
}

module.exports = ReceiptGenerator;
