const redis = require('../config/redis');
const PromptInjectionGuard = require('./PromptInjectionGuard');
const AIProvider = require('./AIProvider');
const PharosKnowledgeService = require('./PharosKnowledgeService');

class AISupportService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Helper to format relative time (e.g. "3 months ago")
   */
  _formatRelativeTime(date) {
    if (!date) return 'New account';
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Created today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months === 1) return '1 month ago';
    return `${months} months ago`;
  }

  /**
   * Builds the context object for the user
   */
  async buildUserContext(wallet) {
    const minDateRes = await this.db.query(
      'SELECT MIN(created_at) as first_tx FROM payments WHERE LOWER(user_wallet) = LOWER($1)',
      [wallet]
    );
    const countRes = await this.db.query(
      'SELECT COUNT(*) as total FROM payments WHERE LOWER(user_wallet) = LOWER($1)',
      [wallet]
    );

    const firstTx = minDateRes.rows[0]?.first_tx;
    const accountAge = this._formatRelativeTime(firstTx);
    const totalPayments = parseInt(countRes.rows[0]?.total || '0');

    // Recent payments (last 5)
    const recentRes = await this.db.query(
      `SELECT p.id as payment_id, p.fiat_amount, p.fiat_currency, p.merchant_identifier, p.country, p.payment_rail, p.status, p.created_at, s.utr, p.pharos_confirm_tx, p.pharos_lock_tx
       FROM payments p
       LEFT JOIN payment_settlements s ON p.id = s.payment_id
       WHERE LOWER(p.user_wallet) = LOWER($1)
       ORDER BY p.created_at DESC LIMIT 5`,
      [wallet]
    );
    const recentPayments = recentRes.rows.map(p => ({
      paymentId: p.payment_id,
      amount: `${p.fiat_currency} ${Number(p.fiat_amount).toFixed(2)}`,
      merchant: p.merchant_identifier,
      country: p.country,
      rail: p.payment_rail,
      status: p.status,
      utr: p.utr,
      confirmTxHash: p.pharos_confirm_tx,
      lockTxHash: p.pharos_lock_tx,
      createdAt: p.created_at,
      failureReason: null
    }));

    // Pending payments (last 10)
    const pendingRes = await this.db.query(
      `SELECT p.id as payment_id, p.fiat_amount, p.fiat_currency, p.merchant_identifier, p.status
       FROM payments p
       WHERE LOWER(p.user_wallet) = LOWER($1)
         AND p.status IN ('PROS_LOCKED', 'SETTLEMENT_STARTED', 'SETTLEMENT_PROCESSING')
       ORDER BY p.created_at DESC LIMIT 10`,
      [wallet]
    );
    const pendingPayments = pendingRes.rows.map(p => ({
      paymentId: p.payment_id,
      amount: `${p.fiat_currency} ${Number(p.fiat_amount).toFixed(2)}`,
      merchant: p.merchant_identifier,
      status: p.status
    }));

    // Failed payments (last 3)
    const failedRes = await this.db.query(
      `SELECT p.id as payment_id, p.fiat_amount, p.fiat_currency, p.status, s.failure_reason
       FROM payments p
       LEFT JOIN payment_settlements s ON p.id = s.payment_id
       WHERE LOWER(p.user_wallet) = LOWER($1)
         AND p.status IN ('SETTLEMENT_FAILED', 'REFUNDED')
       ORDER BY p.created_at DESC LIMIT 3`,
      [wallet]
    );
    const failedPayments = failedRes.rows.map(p => ({
      paymentId: p.payment_id,
      amount: `${p.fiat_currency} ${Number(p.fiat_amount).toFixed(2)}`,
      failureReason: p.failure_reason || 'Settlement failed'
    }));

    // Open tickets (last 3)
    const ticketsRes = await this.db.query(
      `SELECT id, ticket_number, priority, subject, status, created_at
       FROM support_tickets
       WHERE LOWER(user_wallet) = LOWER($1) AND status IN ('open', 'in_progress')
       ORDER BY created_at DESC LIMIT 3`,
      [wallet]
    );
    const openTickets = ticketsRes.rows.map(t => ({
      ticketId: t.ticket_number,
      summary: t.subject,
      severity: t.priority.toUpperCase(),
      status: t.status.toUpperCase(),
      createdAt: t.created_at
    }));

    // Recent receipts (last 3)
    const receiptsRes = await this.db.query(
      `SELECT p.id as payment_id, s.reference_number, p.created_at
       FROM payments p
       JOIN payment_settlements s ON p.id = s.payment_id
       WHERE LOWER(p.user_wallet) = LOWER($1) AND s.reference_number IS NOT NULL
       ORDER BY p.created_at DESC LIMIT 3`,
      [wallet]
    );
    const recentReceipts = receiptsRes.rows.map(r => ({
      receiptId: r.reference_number,
      paymentId: r.payment_id,
      createdAt: r.created_at
    }));

    return {
      wallet,
      accountAge,
      totalPayments,
      recentPayments,
      pendingPayments,
      failedPayments,
      openTickets,
      recentReceipts
    };
  }

  contextToText(ctx) {
    const lines = [
      `Wallet: ${ctx.wallet}`,
      `Account age: ${ctx.accountAge}`,
      `Total payments made: ${ctx.totalPayments}`,
      '',
      `RECENT UTRs:\n` +
        (ctx.recentPayments.filter(p => p.utr).map(p => `  - ${p.paymentId}: ${p.utr}`).join('\n') || '  - No recent UTRs.'),
      '',
      `RECENT TRANSACTION HASHES:\n` +
        (ctx.recentPayments.filter(p => p.confirmTxHash).map(p => `  - ${p.paymentId}: ${p.confirmTxHash}`).join('\n') || '  - No recent tx hashes.'),
      '',
      `RECENT RECEIPTS:\n` +
        (ctx.recentReceipts && ctx.recentReceipts.length > 0
          ? ctx.recentReceipts.map(r => `  - Receipt ID: ${r.receiptId} for Payment: ${r.paymentId}`).join('\n')
          : '  - No recent receipts.'),
      '',
      ctx.pendingPayments.length > 0
        ? `PENDING PAYMENTS (${ctx.pendingPayments.length}):\n` +
          ctx.pendingPayments.map(p =>
            `  - ${p.paymentId} | ${p.amount} to ${p.merchant} | ${p.status}`
          ).join('\n')
        : 'No pending payments.',
      '',
      ctx.failedPayments.length > 0
        ? `FAILED PAYMENTS (${ctx.failedPayments.length}):\n` +
          ctx.failedPayments.map(p =>
            `  - ${p.paymentId} | ${p.amount} | Reason: ${p.failureReason || 'Unknown'}`
          ).join('\n')
        : 'No recent failed payments.',
      '',
      `RECENT PAYMENTS (last 5):\n` +
        ctx.recentPayments.map(p =>
          `  - ${p.paymentId} | ${p.amount} -> ${p.merchant} | ${p.status}` +
          (p.utr ? ` | UTR: ${p.utr}` : '') +
          (p.confirmTxHash ? ` | Tx Hash: ${p.confirmTxHash}` : '')
        ).join('\n'),
      '',
      ctx.openTickets.length > 0
        ? `OPEN SUPPORT TICKETS:\n` +
          ctx.openTickets.map(t =>
            `  - ${t.ticketId} | ${t.severity} | ${t.summary}`
          ).join('\n')
        : 'No open support tickets.'
    ];

    let joined = lines.join('\n');

    // Context size management
    if (joined.length > 3000) {
      // Step 1 reduction
      ctx.recentPayments = ctx.recentPayments.slice(0, 3);
      ctx.pendingPayments = ctx.pendingPayments.slice(0, 5);
      ctx.recentReceipts = [];
      joined = this.contextToText(ctx);
    }
    if (joined.length > 3000) {
      // Step 2 reduction
      const reducedLines = [
        `Wallet: ${ctx.wallet}`,
        `Account age: ${ctx.accountAge}`,
        `Total payments made: ${ctx.totalPayments}`,
        '',
        ctx.pendingPayments.length > 0
          ? `PENDING PAYMENTS (last 3):\n` +
            ctx.pendingPayments.slice(0, 3).map(p =>
              `  - ${p.paymentId} | ${p.amount} to ${p.merchant} | ${p.status}`
            ).join('\n')
          : 'No pending payments.',
        '',
        ctx.failedPayments.length > 0
          ? `FAILED PAYMENTS (last 1):\n` +
            ctx.failedPayments.slice(0, 1).map(p =>
              `  - ${p.paymentId} | ${p.amount} | Reason: ${p.failureReason || 'Unknown'}`
            ).join('\n')
          : 'No recent failed payments.'
      ];
      joined = reducedLines.join('\n');
    }

    return joined;
  }

  /**
   * Keyword fallback response when AI services are unavailable.
   * Used ONLY when AI provider is completely offline.
   */
  keywordFallback(message) {
    const lower = message.toLowerCase();
    if (lower.includes('pending') || lower.includes('waiting')) {
      return {
        answer: 'Payments typically settle within 10 seconds for UPI and PIX, or 1-3 business days for ACH/NEFT. You can check your payment status in the History page. If it has been over 24 hours, please escalate.',
        severity: 'MEDIUM',
        category: 'pending_settlement',
        confidence: 1.0,
        needsEscalation: false,
        escalationReason: null,
        suggestedActions: ['Check history tab', 'Wait for transaction confirmation'],
        relatedPayments: [],
        modelUsed: 'KeywordFallback',
        processingMs: 1
      };
    }
    if (lower.includes('utr') || lower.includes('reference')) {
      return {
        answer: 'Your UTR number is available on your receipt. Go to History, find the payment, and click View Receipt. If the receipt shows no UTR after settlement is complete, please escalate.',
        severity: 'MEDIUM',
        category: 'missing_utr',
        confidence: 1.0,
        needsEscalation: false,
        escalationReason: null,
        suggestedActions: ['Go to History tab', 'Open verification receipt'],
        relatedPayments: [],
        modelUsed: 'KeywordFallback',
        processingMs: 1
      };
    }
    if (lower.includes('refund')) {
      return {
        answer: 'If your payment failed, your PROS tokens are automatically refunded to your wallet within 60 seconds. If you have not received the refund after 5 minutes, please escalate this to our team.',
        severity: 'HIGH',
        category: 'refund_request',
        confidence: 1.0,
        needsEscalation: true,
        escalationReason: 'Automatic refund delay reported',
        suggestedActions: ['Check metamask tokens list', 'Escalate details to human agent'],
        relatedPayments: [],
        modelUsed: 'KeywordFallback',
        processingMs: 1
      };
    }
    if (lower.includes('failed') || lower.includes('error')) {
      return {
        answer: 'Payment failures are usually caused by incorrect merchant identifiers or temporary settlement partner outages. Your PROS tokens will be automatically refunded if the payment did not complete. Please check your wallet balance.',
        severity: 'HIGH',
        category: 'failed_payment',
        confidence: 1.0,
        needsEscalation: true,
        escalationReason: 'Client reported failed checkout flow',
        suggestedActions: ['Verify recipient UPI/PIX address', 'Contact support desk'],
        relatedPayments: [],
        modelUsed: 'KeywordFallback',
        processingMs: 1
      };
    }
    return {
      answer: 'I apologize, the AI assistant is temporarily unavailable. Please try again in a moment, or click "Escalate to Human" if your issue is urgent.',
      severity: 'MEDIUM',
      category: 'general_question',
      confidence: 1.0,
      needsEscalation: false,
      escalationReason: null,
      suggestedActions: ['Try again shortly', 'Click Escalate to contact team'],
      relatedPayments: [],
      modelUsed: 'KeywordFallback',
      processingMs: 1
    };
  }

  _isPaymentRelated(message) {
    if (!message) return false;
    const lower = message.toLowerCase();
    // UUID regex
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    // Tx hash regex (EVM style)
    const txHashRegex = /0x[0-9a-f]{64}/i;
    // UTR regex (e.g. UPI12345678)
    const utrRegex = /\b(upi|pix|paynow|ach|sepa)\w+/i;
    
    return uuidRegex.test(lower) || txHashRegex.test(lower) || utrRegex.test(lower);
  }

  /**
   * Detect if a message is conversational (greetings, follow-ups, identity questions, 
   * short replies, thank-yous, etc.) that should ALWAYS be passed to the AI.
   */
  _isConversational(message) {
    if (!message) return false;
    const lower = message.toLowerCase().trim();
    
    // Very short messages (under 5 words) are almost always follow-ups or conversational
    const wordCount = lower.split(/\s+/).length;
    if (wordCount <= 4) return true;

    // Explicit conversational patterns
    const conversationalPatterns = [
      // Greetings
      /^(hi|hey|hello|yo|sup|howdy|good\s*(morning|afternoon|evening|night)|gm|gn)\b/,
      // Thanks
      /^(thanks?|thank\s*you|thx|ty|tysm|appreciate|cheers)\b/,
      // Identity / capability questions
      /who\s*(are|r)\s*(you|u)/,
      /what\s*(are|r)\s*(you|u)/,
      /what\s*can\s*(you|u)\s*do/,
      /what\s*do\s*(you|u)\s*do/,
      /how\s*can\s*(you|u)\s*help/,
      /are\s*(you|u)\s*(a\s*)?(bot|ai|human|real|assistant)/,
      // Confirmations / follow-ups
      /^(yes|no|yeah|yep|nope|nah|ok|okay|sure|got\s*it|understood|alright|fine|cool|nice|great|awesome)\b/,
      // Questions that need context
      /^(why|how|what|when|where|which|huh|hmm|really|explain|elaborate|clarify|tell\s*me\s*more)\b/,
      // Emotional / urgent
      /^(help|please|urgent|asap|emergency|sos)\b/,
      // Goodbye
      /^(bye|goodbye|see\s*ya|later|take\s*care|cya)\b/,
    ];

    return conversationalPatterns.some(p => p.test(lower));
  }

  /**
   * Detect if a message is strictly out of scope (entertainment, unrelated topics).
   * Only truly unrelated topics should be blocked.
   */
  _isStrictlyOutOfScope(message) {
    if (!message) return false;
    const lower = message.toLowerCase().trim();
    
    // Only block truly unrelated entertainment/general-knowledge requests
    const outOfScopePatterns = [
      /\b(write|compose|create)\s+(a\s+)?(poem|song|story|essay|joke|limerick|haiku)/i,
      /\b(sing|rap|dance|perform)\b/i,
      /\b(ronaldo|messi|neymar|lebron|cricket|football|soccer|nba|ipl|world\s*cup)\b/i,
      /\b(weather|forecast|temperature|rain|sunny)\s+(in|at|for)\b/i,
      /\b(recipe|cook|bake|ingredients)\s+(for|of)\b/i,
      /\b(movie|film|tv\s*show|netflix|anime)\s+(recommend|suggest)/i,
    ];

    // Must also NOT contain any Pharos/crypto/payment terms
    const hasPharosContext = /\b(pharos|pros|payment|pay|wallet|settle|merchant|upi|pix|receipt|ticket|support|blockchain|token|transaction|tx|hash|utr|fiat|crypto)\b/i.test(lower);
    
    if (hasPharosContext) return false;

    return outOfScopePatterns.some(p => p.test(lower));
  }

  /**
   * Check if a message has conversation history context (i.e., it's not the first message).
   * Short messages in an active conversation should always go to the AI.
   */
  _hasConversationHistory(historyMessages) {
    // If there are previous messages in the session, the user is in an active conversation
    return historyMessages && historyMessages.length > 0;
  }

  /**
   * Anti-repetition: Compare a response against recent AI responses.
   * Returns true if the response is too similar to a recent one.
   */
  _isRepetitive(newResponse, recentAiMessages) {
    if (!recentAiMessages || recentAiMessages.length === 0) return false;
    
    const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const newNorm = normalize(newResponse);
    
    // Check similarity against last 5 AI messages
    const recent = recentAiMessages.slice(-5);
    for (const prev of recent) {
      const prevNorm = normalize(prev);
      if (!prevNorm || !newNorm) continue;
      
      // Exact match
      if (newNorm === prevNorm) return true;
      
      // Check if first 100 chars are identical (catches near-duplicates)
      if (newNorm.substring(0, 100) === prevNorm.substring(0, 100) && newNorm.length > 50) return true;
      
      // Jaccard similarity on word sets
      const newWords = new Set(newNorm.split(/\s+/));
      const prevWords = new Set(prevNorm.split(/\s+/));
      const intersection = [...newWords].filter(w => prevWords.has(w)).length;
      const union = new Set([...newWords, ...prevWords]).size;
      const similarity = union > 0 ? intersection / union : 0;
      
      if (similarity > 0.85) return true;
    }
    
    return false;
  }

  /**
   * Main completion call linking history, AIProvider, and retries
   */
  async getCompletion(sessionId, wallet, message, contextText) {
    const startTime = Date.now();
    const historyKey = `support:session:${sessionId}:history`;

    // 1. Always query database for fresh user context to prevent stale cache
    let freshContextText = '';
    let rawContext = {};
    try {
      rawContext = await this.buildUserContext(wallet);
      freshContextText = this.contextToText(rawContext);
    } catch (err) {
      console.error('[AISupportService] Failed to query fresh user context:', err.message);
      freshContextText = contextText || '';
    }

    // 2. Load ticket, payment, and settlement data
    let ticketData = null;
    let paymentData = null;
    let settlementData = null;

    try {
      let ticketId = null;
      if (sessionId && sessionId.startsWith('ticket_')) {
        ticketId = sessionId.split('_')[1];
      } else {
        const sRes = await this.db.query(
          `SELECT ticket_id FROM support_sessions WHERE session_id = $1`,
          [sessionId]
        );
        if (sRes.rows[0]?.ticket_id) {
          ticketId = sRes.rows[0].ticket_id;
        } else {
          const scRes = await this.db.query(
            `SELECT ticket_id FROM support_chat_sessions WHERE session_id = $1`,
            [sessionId]
          );
          if (scRes.rows[0]?.ticket_id) {
            ticketId = scRes.rows[0].ticket_id;
          }
        }
      }

      if (ticketId) {
        const tRes = await this.db.query(
          `SELECT * FROM support_tickets WHERE id = $1 OR ticket_number = $1`,
          [ticketId]
        );
        if (tRes.rows.length > 0) {
          ticketData = tRes.rows[0];
        }
      }

      let paymentId = ticketData?.payment_id;
      if (!paymentId) {
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = message.match(uuidRegex);
        if (match) {
          paymentId = match[0];
        }
      }

      if (paymentId) {
        const pRes = await this.db.query(
          `SELECT * FROM payments WHERE id = $1`,
          [paymentId]
        );
        if (pRes.rows.length > 0) {
          paymentData = pRes.rows[0];
          const settRes = await this.db.query(
            `SELECT * FROM payment_settlements WHERE payment_id = $1`,
            [paymentData.id]
          );
          if (settRes.rows.length > 0) {
            settlementData = settRes.rows[0];
          }
        }
      }
    } catch (dbErr) {
      console.error('[AISupportService] Failed to load ticket/payment/settlement context:', dbErr.message);
    }

    // Combine loaded context
    let combinedContext = freshContextText;
    if (ticketData || paymentData || settlementData) {
      let extraContext = "\n\n--- RELATED TICKET & PAYMENT CONTEXT ---\n";
      if (ticketData) {
        extraContext += `Ticket Number: ${ticketData.ticket_number}\nSubject: ${ticketData.subject}\nStatus: ${ticketData.status.toUpperCase()}\nPriority: ${ticketData.priority.toUpperCase()}\nCategory: ${ticketData.category}\n`;
      }
      if (paymentData) {
        extraContext += `Payment ID: ${paymentData.id}\nAmount: ${paymentData.fiat_amount} ${paymentData.fiat_currency}\nStatus: ${paymentData.status}\nMerchant: ${paymentData.merchant_identifier}\nCreated At: ${paymentData.created_at}\n`;
      }
      if (settlementData) {
        extraContext += `Settlement UTR: ${settlementData.utr || 'N/A'}\nSettlement Status: ${settlementData.status}\nReference Number: ${settlementData.reference_number || 'N/A'}\nFailure Reason: ${settlementData.failure_reason || 'N/A'}\n`;
      }
      extraContext += "-----------------------------------------\n";
      combinedContext += extraContext;
    }

    // 3. Load conversation history from database FIRST (needed for scope decisions)
    let dbMessages = [];
    try {
      if (sessionId && sessionId.startsWith('ticket_')) {
        const ticketIdStr = sessionId.split('_')[1];
        const res = await this.db.query(
          `SELECT sender_type, message FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
          [ticketIdStr]
        );
        dbMessages = res.rows.map(row => ({
          role: row.sender_type === 'user' ? 'user' : (row.sender_type === 'system' ? 'system' : 'assistant'),
          content: row.message
        }));
      } else {
        const res = await this.db.query(
          `SELECT role, message FROM support_chat_messages WHERE session_id = $1 ORDER BY timestamp ASC`,
          [sessionId]
        );
        dbMessages = res.rows.map(row => ({
          role: row.role,
          content: row.message
        }));
      }
    } catch (err) {
      console.error('[AISupportService] Failed to load history from database:', err.message);
    }

    // 4. Fetch live PROS price data for injection into system prompt
    let livePriceData = null;
    try {
      const priceRes = await this.db.query(
        `SELECT pros_price_at_execution, fx_rate_at_execution, fiat_currency, fiat_amount, pros_amount_executed as pros_amount, price_source, created_at
         FROM payments
         WHERE pros_price_at_execution IS NOT NULL AND pros_price_at_execution > 0
         ORDER BY created_at DESC LIMIT 1`
      );
      if (priceRes.rows.length > 0) {
        livePriceData = priceRes.rows[0];
      }
    } catch (priceErr) {
      console.warn('[AISupportService] Failed to fetch live price data:', priceErr.message);
    }

    // 5. Intelligent scope gating (context-aware)
    const isConversational = this._isConversational(message);
    const isPaymentRelated = this._isPaymentRelated(message);
    const isStrictlyOutOfScope = this._isStrictlyOutOfScope(message);
    const hasHistory = this._hasConversationHistory(dbMessages);
    const knowledgeMatches = PharosKnowledgeService.search(message);

    // Price/ecosystem questions always allowed
    const lower = message.toLowerCase();
    const isPriceQuery = /\b(price|rate|cost|worth|value|how much|pros.+usd|usd.+pros|conversion|exchange|convert|quote|current|live|market)\b/i.test(lower);
    const isPharosEcosystem = /\b(pharos|pros|atlantic|testnet|mainnet|explorer|pharosscan|router|oracle|contract|ca|blockchain|roadmap|ecosystem|token|layer.?1|l1|defi|rwa)\b/i.test(lower);

    // Decision logic — VERY permissive for Pharos/payment topics:
    const shouldAllowThrough = isConversational || isPaymentRelated || knowledgeMatches.length > 0 || hasHistory || isPriceQuery || isPharosEcosystem;

    if (isStrictlyOutOfScope && !isPaymentRelated && !hasHistory && !isPharosEcosystem) {
      console.log(`[AI RESPONSE] StrictOutOfScope blocked message: "${message}"`);
      return {
        answer: "I appreciate the question, but I'm specifically designed to help with PharosPay and the Pharos ecosystem. I can assist with payments, settlements, wallet issues, receipts, UTR lookups, and blockchain questions.\n\nHow can I help you with any of those?",
        modelUsed: "ScopeFilter",
        processingMs: Date.now() - startTime
      };
    }

    if (!shouldAllowThrough) {
      console.log(`[AI RESPONSE] ScopeFilter — passing to AI anyway for: "${message}"`);
      // Pass through instead of hard-blocking; let AI handle gracefully
    }

    // 5. Fallback if AI provider is disabled
    if (!AIProvider.getStatus().enabled) {
      console.warn('AI provider not enabled. Falling back to keyword fallback.');
      const fallback = this.keywordFallback(message);
      return fallback;
    }

    // Compile retrieved knowledge context
    let retrievedContext = "";
    if (knowledgeMatches.length > 0) {
      retrievedContext = "--- RETRIEVED PHAROS KNOWLEDGE ---\n" +
        knowledgeMatches.map(m => {
          let section = `Category: ${m.category}\nTitle: ${m.title}\nContent: ${m.content}`;
          if (m.links && m.links.length > 0) {
            section += `\nLinks:\n` + m.links.map(l => `  - ${l}`).join('\n');
          }
          return section;
        }).join('\n\n') +
        "\n----------------------------------";
    }

    // Build conversation summary from history for context injection
    let conversationSummary = "";
    if (dbMessages.length > 0) {
      const recentExchanges = dbMessages.slice(-10);
      conversationSummary = "--- CONVERSATION HISTORY (recent) ---\n" +
        recentExchanges.map(m => {
          const role = m.role === 'user' ? 'User' : 'Assistant';
          // Truncate very long messages in summary
          const content = m.content.length > 200 ? m.content.substring(0, 200) + '...' : m.content;
          return `${role}: ${content}`;
        }).join('\n') +
        "\n--- END CONVERSATION HISTORY ---";
    }

    // Build live price section for system prompt
    let livePriceSection = '';
    if (livePriceData) {
      const prosPrice = Number(livePriceData.pros_price_at_execution).toFixed(4);
      const fxRate = livePriceData.fx_rate_at_execution ? Number(livePriceData.fx_rate_at_execution).toFixed(4) : null;
      const currency = livePriceData.fiat_currency || 'INR';
      const src = livePriceData.price_source || 'Coinbase';
      const updatedAt = livePriceData.created_at ? new Date(livePriceData.created_at).toLocaleString() : 'recently';
      livePriceSection = `
--- LIVE PROS PRICE DATA (use this when user asks about price) ---
Current PROS/USD Price: $${prosPrice}
Price Source: ${src}
${fxRate ? `FX Rate: 1 USD = ${fxRate} ${currency}` : ''}
Last known execution: ${updatedAt}

Example calculation for user reference:
- To pay ${currency === 'INR' ? '₹100' : '100 ' + currency}: divide by FX rate to get USD, then divide by PROS price
${fxRate ? `- ₹100 = $${(100 / Number(fxRate)).toFixed(4)} USD = ${(100 / Number(fxRate) / Number(livePriceData.pros_price_at_execution)).toFixed(4)} PROS` : ''}
-------------------------------------------------------------------`;
    }

    const systemPrompt = `You are the PharosPay Support Assistant — a knowledgeable, friendly expert on the Pharos blockchain ecosystem, PharosPay payments, and crypto-to-fiat technology.

IDENTITY:
- You are the official PharosPay AI support agent.
- You answer ALL questions about PharosPay, Pharos blockchain, PROS tokens, payments, settlements, wallets, receipts, and the broader ecosystem.
- When asked who you are: "I'm the PharosPay Support Assistant. I can help with payments, settlements, wallet issues, PROS pricing, receipts, and all things Pharos."

ANSWER ALL PHAROS ECOSYSTEM QUESTIONS:
You MUST answer (never refuse) questions like:
- "What is PROS price?" — Use the live price data above.
- "What is Pharos?" — Pharos is a high-performance EVM-compatible Layer 1 blockchain.
- "What is PharosPay?" — Explain the crypto-to-fiat payment protocol.
- "What is the Atlantic Testnet?" — Chain ID 688689, RPC https://atlantic.dplabs-internal.com
- "What is the Router Contract?" — 0x7c1B6eeCCb881dA5EBA50Ec1e7202B0De76E11A0
- "What is the Price Oracle CA?" — 0xe2eD0C7c82195BC462A976dB198d973d395D9805
- "How do settlements work?" — PROS locked on-chain, fiat sent to merchant via UPI/PIX/etc.
- "How do receipts work?" — Cryptographic HMAC-SHA256 receipts, downloadable as PDF.
- "How does the oracle work?" — Fetches PROS/USD price from Coinbase every 30 seconds.
- "What is the explorer?" — PharosScan at https://pharosscan.xyz/

CONVERSATION RULES:
1. ALWAYS read full chat history. Reference previous messages when relevant.
2. Follow-up questions ("Why?", "How?", "Explain?") refer to the previous message.
3. Pronouns ("it", "that", "this") refer to things discussed earlier.
4. NEVER repeat the same response. Rephrase or ask a clarifying question.
5. Keep responses concise: 2-4 sentences for simple questions, longer for technical ones.
6. For greetings: respond warmly, ask how you can help.
7. For thanks: "You're welcome! Let me know if you need anything else."
8. For goodbye: "Take care! Feel free to come back anytime."

PHAROS KNOWLEDGE:
- Pharos: High-performance EVM L1 blockchain, sub-second finality, near-zero gas fees.
- PharosPay: Converts PROS tokens to fiat (INR, BRL, SGD, USD, EUR) via UPI, PIX, PayNow, ACH, SEPA.
- Official Website: https://www.pharos.xyz/
- Documentation: https://docs.pharos.xyz/
- Explorer: https://pharosscan.xyz/
- Atlantic Testnet Chain ID: 688689
- Price Oracle / PROS Token CA: 0xe2eD0C7c82195BC462A976dB198d973d395D9805
- PharosPay Router Contract: 0x7c1B6eeCCb881dA5EBA50Ec1e7202B0De76E11A0

SUPPORT CAPABILITIES:
- Payment status lookups, transaction verification
- Settlement tracking, UTR lookups
- Receipt finding and verification
- Wallet connection help, MetaMask setup
- Merchant onboarding questions
- PROS price and conversion questions
- Pharos ecosystem, roadmap, and technical questions
- Ticket escalation for critical issues

WHEN USER REPORTS CRITICAL ISSUES (lost funds, wrong transfer, scam, large amounts):
Say: "This requires immediate attention. Let me collect some details to investigate."
Ask for: wallet address, transaction hash, approximate time, amount involved. Then offer to escalate.

WHEN INFORMATION IS MISSING: Ask intelligent follow-up questions. Do not guess.

SCOPE: Only redirect for truly unrelated topics (sports, weather, cooking, movies).
NEVER say "I can only assist with..." or "I cannot provide..." for Pharos/price questions.

FORMAT:
- Plain text only. No markdown symbols (no *, #, backticks, ~).
- Use line breaks for paragraphs.
- Be concise and natural.

ANTI-REPETITION: Never output the same paragraph twice in a session.
${livePriceSection}
${retrievedContext ? '\n' + retrievedContext + '\n' : ''}
--- USER CONTEXT ---
${combinedContext}
--- END CONTEXT ---

${conversationSummary ? '\n' + conversationSummary + '\n' : ''}`;

    // 6. Build conversation messages array
    let conversationHistory = [];
    conversationHistory.push({ role: 'system', content: systemPrompt });
    
    for (const msgObj of dbMessages) {
      if (msgObj.role === 'system') continue;
      conversationHistory.push({ role: msgObj.role === 'user' ? 'user' : 'assistant', content: msgObj.content });
    }

    // Ensure the current user message is appended if not already present at the end
    const lastMsg = conversationHistory[conversationHistory.length - 1];
    if (!lastMsg || lastMsg.content !== message || lastMsg.role !== 'user') {
      conversationHistory.push({ role: 'user', content: message });
    }

    // Keep only system prompt + last 20 messages (21 elements max)
    if (conversationHistory.length > 21) {
      const system = conversationHistory[0];
      const rest = conversationHistory.slice(conversationHistory.length - 20);
      conversationHistory = [system, ...rest];
    }

    try {
      const aiResponse = await AIProvider.getCompletion(conversationHistory);

      // Anti-repetition check against recent AI messages
      const recentAiMessages = dbMessages
        .filter(m => m.role === 'assistant')
        .map(m => m.content)
        .slice(-5);

      if (this._isRepetitive(aiResponse.answer, recentAiMessages)) {
        console.log('[AI RESPONSE] Detected repetitive response. Requesting regeneration...');
        
        // Add instruction to avoid repetition and regenerate
        conversationHistory.push({ role: 'assistant', content: aiResponse.answer });
        conversationHistory.push({ 
          role: 'user', 
          content: '[System: Your previous response was too similar to an earlier message. Please provide a different, unique response that adds new information or asks a clarifying question. Do not repeat yourself.]' 
        });

        try {
          const retryResponse = await AIProvider.getCompletion(conversationHistory);
          // Remove the injected messages
          conversationHistory.pop();
          conversationHistory.pop();
          
          aiResponse.answer = retryResponse.answer;
          aiResponse.processingMs = (aiResponse.processingMs || 0) + (retryResponse.processingMs || 0);
        } catch (retryErr) {
          console.warn('[AI RESPONSE] Regeneration failed, using original:', retryErr.message);
          // Remove the injected messages
          conversationHistory.pop();
          conversationHistory.pop();
        }
      }

      // Append AI response to conversation history & cache back to Redis if ready
      conversationHistory.push({ role: 'assistant', content: aiResponse.answer });
      if (redis.status === 'ready') {
        try {
          await redis.set(historyKey, JSON.stringify(conversationHistory), 'EX', 7200); // 2h TTL
        } catch (rErr) {
          console.warn('[Redis Client] History write failed:', rErr.message);
        }
      }

      const processingMs = Date.now() - startTime;

      // Log attempt details to audit logs
      try {
        await this.db.query(
          `INSERT INTO audit_logs (action, actor, details, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [
            'ai_support_chat',
            wallet,
            JSON.stringify({
              sessionId,
              model: aiResponse.modelUsed,
              promptTokens: aiResponse.promptTokens,
              completionTokens: aiResponse.completionTokens,
              processingMs
            })
          ]
        );
      } catch (err) {
        console.error('Failed to write audit log:', err.message);
      }

      return {
        answer: aiResponse.answer,
        modelUsed: aiResponse.modelUsed,
        processingMs
      };
    } catch (err) {
      console.error('[AISupportService] AI completion failed:', err.message);
      
      if (err.message === 'AI provider timeout') {
        throw err;
      }

      const fb = this.keywordFallback(message);
      return fb;
    }
  }
}

module.exports = AISupportService;
