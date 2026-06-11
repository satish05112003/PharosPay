const { Queue, Worker } = require('bullmq');
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');

const upiValidator = require('../validators/upiValidator');
const pixValidator = require('../validators/pixValidator');
const paynowValidator = require('../validators/paynowValidator');
const achValidator = require('../validators/achValidator');
const priceService = require('./PriceService');
const { RAIL_MAP } = require('../lib/qrParser');

class SettlementEngine {
  constructor(db, providerFactory, redisConnection) {
    this.db = db;
    this.providerFactory = providerFactory;
    
    // Set up operator wallet connection for smart contract callbacks
    const rpcUrl = process.env.PHAROS_RPC_URL || 'https://atlantic.dplabs-internal.com';
    const routerAddress = process.env.PHAROS_CONTRACT_ADDRESS || '0x7c1B6eeCCb881dA5EBA50Ec1e7202B0De76E11A0';
    
    if (process.env.PHAROS_OPERATOR_PRIVATE_KEY) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(process.env.PHAROS_OPERATOR_PRIVATE_KEY, this.provider);
        this.routerContract = new ethers.Contract(routerAddress, [
          'function confirmSettlement(bytes32 paymentId, bytes32 settlementReference) external',
          'function refundPROS(bytes32 paymentId, string calldata reason) external'
        ], this.wallet);
      } catch (err) {
        console.error('Operator wallet initialization failed:', err.message);
      }
    }

    // Initialize BullMQ Queue with fallback
    const useRedis = process.env.USE_REDIS === 'true' || !!redisConnection;
    if (useRedis) {
      try {
        this.queue = new Queue('settlement', { connection: redisConnection });
        this.worker = new Worker('settlement', async (job) => {
          await this.processJob(job);
        }, { connection: redisConnection, concurrency: 5 });

        this.worker.on('failed', (job, err) => {
          console.error(`Settlement job failed: ${job.id}`, err);
        });
        console.log('BullMQ initialized successfully.');
      } catch (err) {
        console.warn('Redis/BullMQ failed to connect. Falling back to direct in-memory queue simulation.');
        this.setupFallbackQueue();
      }
    } else {
      console.log('Redis connection not enabled. Initializing in-memory fallback queue.');
      this.setupFallbackQueue();
    }
  }

  setupFallbackQueue() {
    this.queue = {
      add: async (name, data) => {
        setTimeout(() => {
          this.processJob({ data }).catch(e => console.error('In-memory queue processing error:', e));
        }, 500);
        return { id: 'sim_job_' + uuidv4() };
      }
    };
  }


  // Called by event listener when PaymentInitiated fires on-chain
  async handlePaymentInitiated(onChainEvent) {
    const { paymentId, payer, merchantIdentifier, fiatAmountX6,
            fiatCurrency, paymentRail, tokenAmount, timestamp } = onChainEvent;

    // Check idempotency: do not process same paymentId twice
    const existing = await this.db.payments.findByPharosPaymentId(paymentId);
    if (existing) {
      console.log(`Payment ${paymentId} already processed. Skipping.`);
      return;
    }

    // Parse country from currency or rail context
    const country = this.detectCountry(fiatCurrency.toString(), paymentRail.toString());

    // 1. Resolve or create Beneficiary
    let beneficiary = await this.db.beneficiaries.findByIdentifier(country, paymentRail, merchantIdentifier);
    if (!beneficiary) {
      beneficiary = await this.db.beneficiaries.create({
        country,
        paymentRail,
        identifier: merchantIdentifier,
        identifierType: this.detectIdentifierType(merchantIdentifier, country),
        isVerified: false
      });
    }

    // Resolve pricing metadata
    let liveTokenPrice = null;
    let liveFxRate = null;
    let priceSource = null;
    let quoteTimestamp = null;
    try {
      const currencyStr = fiatCurrency.toString().toUpperCase();
      // Fetch fresh live rates directly (bypassing oracle caches/circularity)
      const tokenDetails = await priceService.fetchTokenUsdPrice();
      const fiatDetails = await priceService.fetchUsdRate(currencyStr);
      liveTokenPrice = tokenDetails.price;
      liveFxRate = fiatDetails.price;
      priceSource = tokenDetails.source;
      quoteTimestamp = new Date(tokenDetails.updatedAt);
    } catch (e) {
      console.warn("SettlementEngine: failed to resolve rates for payment creation audit:", e.message);
    }

    // Default fallbacks to prevent crash if external APIs are completely down
    if (!liveTokenPrice || liveTokenPrice <= 0) liveTokenPrice = 0.6144;
    if (!liveFxRate || liveFxRate <= 0) liveFxRate = 95.1808;

    const fiatAmount = Number(fiatAmountX6) / 1e6;
    
    // Single source of truth calculation:
    const finalTokenAmount = ((fiatAmount / liveFxRate) / liveTokenPrice) * 1.02;

    // 2. Create payment record in database
    const networkConfigService = require('./NetworkConfigService');
    const payment = await this.db.payments.create({
      pharosPaymentId: paymentId,
      userWallet: payer,
      merchantId: beneficiary.id,
      merchantIdentifier,
      country,
      paymentRail: paymentRail.toString(),
      fiatAmount: fiatAmount,
      fiatCurrency: fiatCurrency.toString(),
      tokenAmount: finalTokenAmount,
      tokenSymbol: networkConfigService.getPaymentToken().symbol,
      tokenUsdRate: liveTokenPrice,
      usdFiatRate: liveFxRate,
      tokenPriceAtExecution: liveTokenPrice,
      fxRateAtExecution: liveFxRate,
      quoteTimestamp,
      priceSource,
      tokenAmountExecuted: finalTokenAmount,
      usdAmountAtExecution: liveFxRate > 0 ? fiatAmount / liveFxRate : 0,
      status: 'TOKEN_LOCKED',
      idempotencyKey: uuidv4(),
      usdInrRate: liveFxRate,
      tokenUsdPrice: liveTokenPrice,
      feePercent: 2.00,
      timestamp: new Date(),
      pharosLockTx: onChainEvent.pharosLockTx || null
    });

    // 3. Enqueue settlement job
    await this.queue.add('settle', {
      paymentId: payment.id,
      pharosPaymentId: paymentId,
      merchantIdentifier,
      country,
      paymentRail: paymentRail.toString(),
      fiatAmount: Number(fiatAmountX6) / 1e6,
      fiatCurrency: fiatCurrency.toString()
    });

    await this.logEvent(payment.id, 'SETTLEMENT_QUEUED', 'INITIATED',
                        'TOKEN_LOCKED', 'system', {});
  }

  async processJob(job) {
    const { paymentId, pharosPaymentId, merchantIdentifier, country, paymentRail,
            fiatAmount, fiatCurrency } = job.data;

    console.log(`SettlementEngine: Processing payment ${paymentId} (${pharosPaymentId})...`);

    // Step 1: Update status
    await this.db.payments.updateStatus(paymentId, 'SETTLEMENT_STARTED');
    await this.logEvent(paymentId, 'SETTLEMENT_STARTED', 'TOKEN_LOCKED', 'SETTLEMENT_STARTED', 'system');

    // Step 2: Validate merchant
    const validation = await this.validateMerchant(merchantIdentifier, country, paymentRail);
    if (!validation.valid) {
      await this.handleFailure(paymentId, `Invalid merchant identifier: ${validation.message}`);
      return;
    }

    // Step 3: Select provider
    const provider = this.providerFactory.getProvider(country, paymentRail);

    const paymentRecord = await this.db.payments.findById(paymentId);

    const networkConfigService = require('./NetworkConfigService');
    const settlement = await this.db.settlements.create({
      paymentId,
      providerName: provider.name,
      status: 'PENDING',
      isSimulation: provider.isSimulation,
      tokenSymbol: networkConfigService.getPaymentToken().symbol,
      tokenPriceAtExecution: paymentRecord ? paymentRecord.token_price_at_execution : null,
      fxRateAtExecution: paymentRecord ? paymentRecord.fx_rate_at_execution : null,
      quoteTimestamp: paymentRecord ? paymentRecord.quote_timestamp : null,
      priceSource: paymentRecord ? paymentRecord.price_source : null
    });

    // Step 5: Initiate transfer
    const amountInSmallestUnit = this.toSmallestUnit(fiatAmount, fiatCurrency);
    const transferResult = await provider.initiateTransfer({
      paymentId: pharosPaymentId,
      merchantIdentifier,
      merchantName: validation.beneficiaryName || 'Merchant',
      amount: amountInSmallestUnit,
      currency: fiatCurrency,
      rail: paymentRail,
      country,
      idempotencyKey: `pharos-${pharosPaymentId}`,
      metadata: {}
    });

    // Step 6: Log provider transaction in DB
    await this.db.providerTransactions.create({
      settlementId: settlement.id,
      providerName: provider.name,
      requestPayload: { merchantIdentifier, amount: amountInSmallestUnit, rail: paymentRail },
      responsePayload: transferResult.rawResponse,
      httpStatusCode: transferResult.status === 'FAILED' ? 400 : 200,
      errorMessage: transferResult.status === 'FAILED' ? 'Transfer failed' : null,
      durationMs: 100,
      tokenPriceAtExecution: paymentRecord ? paymentRecord.token_price_at_execution : null,
      fxRateAtExecution: paymentRecord ? paymentRecord.fx_rate_at_execution : null,
      quoteTimestamp: paymentRecord ? paymentRecord.quote_timestamp : null,
      priceSource: paymentRecord ? paymentRecord.price_source : null
    });

    // Step 7: Update settlement with provider reference
    await this.db.settlements.update(settlement.id, {
      providerReference: transferResult.providerReference,
      status: transferResult.status,
      providerResponse: transferResult.rawResponse
    });
    
    await this.db.payments.updateStatus(paymentId, 'SETTLEMENT_PROCESSING');
    await this.logEvent(paymentId, 'SETTLEMENT_IN_FLIGHT', 'SETTLEMENT_STARTED', 'SETTLEMENT_PROCESSING', 'system');

    // Step 8: If immediate success or demo mode auto-resolve
    if (transferResult.status === 'SUCCESS') {
      await this.handleSuccess(paymentId, settlement.id, {
        utr: transferResult.utr,
        providerReference: transferResult.providerReference
      });
    } else if (transferResult.status === 'FAILED') {
      await this.handleFailure(paymentId, 'Transfer rejected by provider');
    } else if (provider.isSimulation) {
      // In demo simulation mode: trigger successful callback after 5s
      setTimeout(async () => {
        const check = await provider.getTransferStatus(transferResult.providerReference);
        await this.handleWebhookUpdate(settlement.id, {
          paymentId: pharosPaymentId,
          providerReference: transferResult.providerReference,
          status: 'SUCCESS',
          utr: check.utr,
          referenceNumber: check.referenceNumber
        });
      }, 5000);
    }
  }

  // Called by webhook processor when provider sends callback
  async handleWebhookUpdate(settlementId, normalizedEvent) {
    const settlement = await this.db.settlements.findById(settlementId);
    if (!settlement) {
      console.error(`Settlement ${settlementId} not found in database.`);
      return;
    }

    console.log(`SettlementEngine: Webhook received for ${settlementId} (Status: ${normalizedEvent.status})`);

    await this.db.settlements.update(settlementId, {
      status: normalizedEvent.status,
      utr: normalizedEvent.utr,
      referenceNumber: normalizedEvent.referenceNumber,
      failureReason: normalizedEvent.failureReason,
      settledAt: normalizedEvent.status === 'SUCCESS' ? new Date() : null,
      webhookReceivedAt: new Date()
    });

    if (normalizedEvent.status === 'SUCCESS') {
      await this.handleSuccess(settlement.payment_id, settlementId, normalizedEvent);
    } else if (normalizedEvent.status === 'FAILED' || normalizedEvent.status === 'REVERSED') {
      await this.handleFailure(settlement.payment_id, normalizedEvent.failureReason || 'Provider callback rejected');
    }
  }

  async handleSuccess(paymentId, settlementId, data) {
    const payment = await this.db.payments.findById(paymentId);
    if (!payment || payment.status === 'SETTLEMENT_COMPLETE') return;

    // Generate PharosPay reference number
    const referenceNumber = await this.generateReference();
    await this.db.settlements.update(settlementId, {
      referenceNumber,
      status: 'SUCCESS',
      settledAt: new Date()
    });

    const referenceHash = ethers.keccak256(ethers.toUtf8Bytes(referenceNumber));
    const isDemo = process.env.DEMO_MODE === 'true' || !this.routerContract;
    const confirmTxHash = isDemo
      ? '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')
      : await this.confirmOnChain(payment.pharos_payment_id, referenceHash);

    await this.db.payments.updateStatus(paymentId, 'SETTLEMENT_COMPLETE', {
      pharos_confirm_tx: confirmTxHash
    });

    // Increment stats in beneficiaries
    await this.db.beneficiaries.incrementStats(
      payment.country, payment.payment_rail, payment.merchant_identifier,
      payment.fiat_amount
    );

    await this.logEvent(paymentId, 'SETTLEMENT_SUCCESS', 'SETTLEMENT_PROCESSING',
                        'SETTLEMENT_COMPLETE', 'system', { utr: data.utr, referenceNumber });
  }

  async handleFailure(paymentId, reason) {
    const payment = await this.db.payments.findById(paymentId);
    if (!payment || payment.status === 'SETTLEMENT_FAILED' || payment.status === 'REFUNDED') return;

    await this.db.payments.updateStatus(paymentId, 'SETTLEMENT_FAILED');

    // Trigger PROS refund on-chain
    await this.triggerRefund(payment.pharos_payment_id, reason);
    await this.db.payments.updateStatus(paymentId, 'REFUNDED');

    await this.logEvent(paymentId, 'SETTLEMENT_FAILED', 'SETTLEMENT_PROCESSING',
                        'REFUNDED', 'system', { reason });
  }

  async validateMerchant(merchantIdentifier, country, rail) {
    const provider = this.providerFactory.getProvider(country, rail);
    try {
      return await provider.verifyBeneficiary(merchantIdentifier, rail);
    } catch (err) {
      return { valid: false, message: err.message };
    }
  }

  async confirmOnChain(pharosPaymentId, referenceHash) {
    if (process.env.DEMO_MODE === 'true' || !this.routerContract) {
      console.log(`[Simulation Mode] Contract confirmSettlement(${pharosPaymentId}, ${referenceHash}) completed.`);
      return null;
    }

    try {
      console.log(`On-Chain: Confirming settlement for ${pharosPaymentId}...`);
      const tx = await this.routerContract.confirmSettlement(pharosPaymentId, referenceHash);
      await tx.wait();
      console.log(`On-Chain: Confirmed in tx ${tx.hash}`);
      return tx.hash;
    } catch (err) {
      console.error('On-Chain Confirm Error:', err.message);
      return null;
    }
  }

  async triggerRefund(pharosPaymentId, reason) {
    if (process.env.DEMO_MODE === 'true' || !this.routerContract) {
      console.log(`[Simulation Mode] Contract refundPROS(${pharosPaymentId}, "${reason}") completed.`);
      return;
    }

    try {
      console.log(`On-Chain: Triggering refund for ${pharosPaymentId} (Reason: ${reason})...`);
      const tx = await this.routerContract.refundPROS(pharosPaymentId, reason);
      await tx.wait();
      console.log(`On-Chain: Refunded in tx ${tx.hash}`);
    } catch (err) {
      console.error('On-Chain Refund Error:', err.message);
    }
  }

  // Helper sequential reference generator
  async generateReference() {
    const year = new Date().getFullYear();
    const count = await this.db.settlements.countSuccessfulToday();
    return `PHAROS-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  toSmallestUnit(amount, currency) {
    const multipliers = { INR: 100, BRL: 100, SGD: 100, USD: 100, JPY: 1 };
    return Math.round(Number(amount) * (multipliers[currency] || 100));
  }

  detectCountry(fiatCurrency, paymentRail) {
    const map = {
      'INR': 'IN', 'BRL': 'BR', 'SGD': 'SG', 'USD': 'US',
      'GBP': 'GB', 'EUR': 'EU', 'JPY': 'JP', 'THB': 'TH'
    };
    return map[fiatCurrency] || 'IN';
  }

  detectIdentifierType(identifier, country) {
    if (country === 'IN') {
      return identifier.includes('@') ? 'UPI_VPA' : 'ACCOUNT_IFSC';
    }
    if (country === 'BR') {
      return 'PIX_KEY';
    }
    if (country === 'SG') {
      return identifier.startsWith('+65') ? 'PAYNOW_PHONE' : 'FAST_ACCOUNT';
    }
    return 'BANK_ACCOUNT';
  }

  async logEvent(paymentId, eventType, fromStatus, toStatus, actor = 'system', metadata = {}) {
    try {
      await this.db.settlementEvents.create({
        paymentId, eventType, fromStatus, toStatus, actor, metadata
      });
    } catch (err) {
      console.error('Failed to log event:', err.message);
    }
  }
}

module.exports = SettlementEngine;
