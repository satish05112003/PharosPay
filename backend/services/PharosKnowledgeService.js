class PharosKnowledgeService {
  constructor() {
    this.knowledgeBase = {
      PHAROS: {
        title: "Pharos Network & Layer 1 Blockchain",
        content: "Pharos is an ultra-fast, high-performance EVM-compatible Layer 1 blockchain designed for mass consumer adoption, real-world assets (RWA), high-throughput financial applications, and real-time payment settlement infrastructure. It is designed to support transaction volumes up to 100,000+ TPS with sub-second block times and near-zero, fraction-of-a-cent gas fees, solving the scalability bottlenecks of legacy chains.",
        links: ["Official Website: https://www.pharos.xyz/"]
      },
      PHAROSPAY: {
        title: "PharosPay Payments Infrastructure",
        content: "PharosPay is a global crypto-to-fiat payment protocol built natively on the Pharos blockchain. It connects on-chain liquidity directly to traditional, off-chain legacy payment networks (like India's UPI, Brazil's PIX, Singapore's PayNow, USA's ACH, and Europe's SEPA). Users scan standard merchant QR codes and pay with $PROS tokens. The payment engine processes the transaction on-chain and initiates fiat payouts directly to the merchant's local bank account with zero crypto exposure or volatility risk for the merchant.",
        links: ["Official Website: https://www.pharos.xyz/"]
      },
      PAYMENTS: {
        title: "Making Payments & Transaction History",
        content: "PharosPay lets users pay merchants directly in their local fiat currency using $PROS tokens. The user scans a merchant QR code, gets a real-time price quote from the PriceOracle contract (taking a 2% fee deposited to the FeeVault contract), and signs the MetaMask transaction on Pharos. Transaction history, including merchant names, fiat amounts, payment rails, and block hashes, can be viewed under the History tab.",
        links: ["Explorer: https://pharosscan.xyz/"]
      },
      SETTLEMENTS: {
        title: "Cross-Border settlements & Payout Rails",
        content: "In PharosPay, once PROS tokens are locked on-chain by the user, the settlement engine automatically routes the payment. Payouts clear via instant payment rails like UPI (India) and PIX (Brazil) in under 10 seconds. For rails like ACH (USA) or SEPA (Europe), settlements typically clear within 1-3 business days. If a payout fail state occurs, locked PROS tokens are automatically refunded to the user's wallet.",
        links: []
      },
      RECEIPTS: {
        title: "Cryptographic Receipts & Verification",
        content: "Every settled transaction emits a public cryptographic receipt containing a unique reference number, merchant information, local fiat amounts, payout banks, and a verifying HMAC-SHA256 signature. Users can download these receipts as PDFs, share them, or verify them publicly at /verify or by scanning the receipt QR code.",
        links: ["Receipt Verification: https://verify.pharospay.xyz/"]
      },
      WALLETS: {
        title: "Wallet Configurations & MetaMask Setup",
        content: "PharosPay supports MetaMask and other EVM-compatible Web3 wallets. Ensure your wallet is configured to the Pharos Atlantic Testnet (Chain ID: 688689) to view your PROS balance and confirm transaction prompts. Native gas fees are paid in PHAROS tokens.",
        links: []
      },
      SUPPORT: {
        title: "Support Tickets & Escalation Desk",
        content: "If you have issues with pending settlements, missing UTRs, or transaction errors, you can create a support ticket in the 'New Ticket' tab. If the assistant flags a critical priority issue, it automatically prompts you to escalate, opening a human agent live takeover handoff session.",
        links: []
      },
      BLOCKCHAIN_EXPLORER: {
        title: "Pharos Blockchain Explorer (PharosScan)",
        content: "PharosScan is the official block explorer for the Pharos blockchain. It allows users to track on-chain transactions, smart contract code, block times, gas fees, and event logs (like PaymentInitiated and FeeDeposited) emitted by the PharosPay protocol.",
        links: ["Explorer: https://pharosscan.xyz/"]
      },
      TESTNET: {
        title: "Pharos Atlantic Testnet Sandbox",
        content: "The Pharos Atlantic Testnet is the active sandbox for testing smart contracts and applications. Faucet tokens and test PHAROS gas are distributed through official channels. Network details:\n- RPC URL: https://atlantic.dplabs-internal.com\n- Chain ID: 688689 (Decimal)\n- Price Oracle Contract: 0xe2eD0C7c82195BC462A976dB198d973d395D9805\n- PharosPay Router Contract: 0x7c1B6eeCCb881dA5EBA50Ec1e7202B0De76E11A0",
        links: ["Documentation: https://docs.pharos.xyz/"]
      },
      MAINNET: {
        title: "Pharos Mainnet Beta & Launch Phase",
        content: "The Pharos Mainnet Beta launch is planned for Q2 2026, opening up early staking and node validator registration. General availability of Mainnet v1.0 and live merchant integrations are scheduled for Q4 2026.",
        links: ["Official Website: https://www.pharos.xyz/"]
      },
      ROADMAP: {
        title: "Pharos Network 2026 Development Roadmap",
        content: "Pharos 2026 Milestone Roadmap:\n- Q1: Atlantic Testnet launch, developer grants, and open validator sandboxes.\n- Q2: Mainnet Beta launch, validator onboarding, and PharosPay simulated fiat payouts.\n- Q3: Multi-chain bridges, token wrapping, smart order routing, and developer SDKs.\n- Q4: Pharos Mainnet v1.0 production launch, global validator staking expansion, and real merchant API integrations.",
        links: ["Documentation: https://docs.pharos.xyz/"]
      },
      DOCS: {
        title: "Developer Documentation & API Guides",
        content: "Pharos developer documentation details RPC endpoints, MetaMask configuration steps, smart contract ABI files, validator staking guides, and sample codes. You can access the developer docs at https://docs.pharos.xyz/ or view our public source repositories on our official GitHub.",
        links: ["Documentation: https://docs.pharos.xyz/", "Official GitHub: https://github.com/pharos-network"]
      },
      ECOSYSTEM: {
        title: "Pharos Ecosystem & Projects",
        content: "The Pharos ecosystem is scaling rapidly, accommodating decentralised finance (DeFi), real-world asset tokenization platforms, validator staking pools, and real-time payment solutions like PharosPay. Staking and consensus verification are live on the Atlantic network.",
        links: ["Official Website: https://www.pharos.xyz/"]
      }
    };
  }

  /**
   * Search query against allowed categories using keyword matches and scoring
   */
  search(query) {
    if (!query) return [];
    const lower = query.toLowerCase().trim();
    const results = [];

    const categoryKeywords = {
      PHAROSPAY: ['pharospay', 'merchant', 'payout', 'fiat', 'quote', 'utr', 'fee', 'fiat amount', 'convert', 'payment rail', 'upi', 'pix', 'paynow', 'ach', 'sepa'],
      PAYMENTS: ['payment', 'pay', 'paid', 'transact', 'send money', 'charge', 'cost', 'spend', 'history', 'tx', 'hash', 'allowance', 'confirm'],
      SETTLEMENTS: ['settle', 'settlement', 'payout', 'bank transfer', 'bank account', 'processing', 'completed', 'failed', 'refund', 'revert'],
      RECEIPTS: ['receipt', 'pdf', 'verify receipt', 'reference number', 'reference_number', 'invoice', 'report', 'suspicious'],
      WALLETS: ['wallet', 'metamask', 'address', 'connect', 'balance', 'pros balance', 'gas', 'private key', 'seed phrase'],
      SUPPORT: ['support', 'help', 'ticket', 'escalate', 'human', 'agent', 'issue', 'error', 'failed', 'unavailable', 'hi', 'hello', 'hey', 'what is this', 'how does it work', 'who are you', 'what can you do', 'thanks', 'thank you', 'bye', 'goodbye', 'good morning', 'good evening', 'how are you', 'ok', 'okay', 'yes', 'no', 'lost', 'missing', 'wrong', 'stuck', 'problem', 'broken'],
      BLOCKCHAIN_EXPLORER: ['explorer', 'pharosscan', 'scan', 'transaction explorer', 'verify on-chain', 'event', 'emitted'],
      TESTNET: ['testnet', 'atlantic', 'rpc', 'chain id', 'chain_id', 'atlantic testnet', 'faucet', 'mint'],
      MAINNET: ['mainnet', 'launch', 'production', 'live network'],
      ROADMAP: ['roadmap', 'future', 'plans', 'release', 'phases', 'q1', 'q2', 'q3', 'q4', '2026'],
      DOCS: ['docs', 'documentation', 'guide', 'tutorial', 'contract address', 'smart contract', 'ca', 'abi', 'developers', 'git', 'github'],
      ECOSYSTEM: ['ecosystem', 'projects', 'partners', 'dapps', 'announcement', 'announcements', 'news', 'latest', 'staking', 'stake', 'validator', 'validators'],
      PHAROS: ['pharos', 'pros', 'token', 'blockchain', 'l1', 'layer 1', 'network', 'atlantic']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          // Boost exact match score
          score += 1;
        }
      }

      if (score > 0) {
        const item = this.knowledgeBase[category];
        results.push({
          category,
          title: item.title,
          content: item.content,
          links: item.links,
          score
        });
      }
    }

    // Sort by match count score descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}

module.exports = new PharosKnowledgeService();
