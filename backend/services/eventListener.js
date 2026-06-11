const { ethers } = require('ethers');

class EventListener {
  constructor(db, settlementEngine) {
    this.db = db;
    this.settlementEngine = settlementEngine;
    this.rpcUrl = process.env.RPC_URL || process.env.PHAROS_RPC_URL || 'https://atlantic.dplabs-internal.com';
    this.routerAddress = process.env.PHAROSPAY_ROUTER || process.env.PHAROS_CONTRACT_ADDRESS || '0x693bec4d6Fa753a27a340e9bC9A14D514fd8D17a';
    this.active = false;
    this.provider = null;
    this.contract = null;
    this.lastBlock = null;
    this.pollInterval = null;
  }

  async start() {
    if (this.active) return;
    this.active = true;

    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      
      const abi = [
        "event PaymentInitiated(bytes32 indexed paymentId, address indexed payer, string merchantId, string merchantName, string fiatCurrency, uint256 fiatAmount, uint256 prosAmount, uint256 feeAmount, string paymentRail, string country)"
      ];

      this.contract = new ethers.Contract(this.routerAddress, abi, this.provider);
      
      // Get current block number to start polling from
      this.lastBlock = await this.provider.getBlockNumber();
      console.log(`EventListener: Starting block polling from block ${this.lastBlock} on ${this.routerAddress}`);

      this.pollInterval = setInterval(async () => {
        try {
          const currentBlock = await this.provider.getBlockNumber();
          if (currentBlock > this.lastBlock) {
            const fromBlock = this.lastBlock + 1;
            const toBlock = currentBlock;
            
            await this.pollLogs(fromBlock, toBlock);
            this.lastBlock = currentBlock;
          }
        } catch (err) {
          console.error("EventListener polling error:", err.message);
        }
      }, 5000); // Check every 5 seconds

    } catch (err) {
      console.error("EventListener: Failed to start listener:", err.message);
      this.active = false;
      // Retry after 10 seconds
      setTimeout(() => this.start(), 10000);
    }
  }

  async pollLogs(fromBlock, toBlock) {
    try {
      // Create filter
      const filter = this.contract.filters.PaymentInitiated();
      
      const logs = await this.provider.getLogs({
        address: this.routerAddress,
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: filter.topics
      });

      for (const log of logs) {
        try {
          const parsed = this.contract.interface.parseLog(log);
          if (!parsed) continue;

          const [paymentId, payer, merchantId, merchantName, fiatCurrency, fiatAmount, prosAmount, feeAmount, paymentRail, country] = parsed.args;

          console.log(`EventListener: Polled PaymentInitiated event for paymentId ${paymentId} in block ${log.blockNumber}`);

          const eventData = {
            paymentId,
            payer,
            merchantIdentifier: merchantId,
            fiatCurrency,
            fiatAmountX6: (BigInt(fiatAmount) / 1000000000000n).toString(),
            tokenAmount: prosAmount.toString(),
            paymentRail,
            country,
            timestamp: Math.floor(Date.now() / 1000),
            pharosLockTx: log.transactionHash
          };

          await this.settlementEngine.handlePaymentInitiated(eventData);
        } catch (err) {
          console.error("EventListener: Error parsing log:", err.message);
        }
      }
    } catch (err) {
      console.error("EventListener getLogs error:", err.message);
    }
  }

  async stop() {
    if (!this.active) return;
    this.active = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    console.log("EventListener: Stopped block polling.");
  }
}

module.exports = EventListener;
