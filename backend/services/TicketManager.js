/**
 * TicketManager Service
 * Orchestrates support ticket lifecycle | creation with auto-categorization,
 * threaded replies, resolution flow, and stats aggregation.
 */
class TicketManager {
  constructor(db) {
    this.db = db;
  }

  // ─── Auto-Categorization ──────────────────────────────────────────────
  /**
   * Rule-based keyword classifier for ticket category assignment.
   * Returns one of: payment_failed, settlement_delayed, pricing_issue,
   * account_issue, feature_request, general
   */
  autoCategory(subject, description) {
    const text = `${subject} ${description}`.toLowerCase();

    const rules = [
      {
        category: 'payment_failed',
        keywords: ['payment failed', 'transaction failed', 'tx failed', 'error paying',
          'could not pay', 'payment error', 'rejected', 'reverted', 'insufficient',
          'approve failed', 'gas error', 'out of gas', 'nonce']
      },
      {
        category: 'settlement_delayed',
        keywords: ['settlement delay', 'not received', 'pending settlement', 'utr missing',
          'settlement pending', 'fiat not received', 'bank not credited', 'delayed payout',
          'waiting for settlement', 'where is my money', 'merchant not paid', 'payout delayed']
      },
      {
        category: 'pricing_issue',
        keywords: ['price wrong', 'wrong rate', 'incorrect price', 'token price',
          'exchange rate', 'fx rate wrong', 'conversion wrong', 'overcharged',
          'price mismatch', 'stale price', 'market data', 'coinbase']
      },
      {
        category: 'account_issue',
        keywords: ['wallet', 'connect wallet', 'metamask', 'login', 'sign in',
          'cannot connect', 'wrong network', 'chain', 'switch network', 'account',
          'kyc', 'verification', 'merchant profile']
      },
      {
        category: 'feature_request',
        keywords: ['feature request', 'suggestion', 'would be nice', 'please add',
          'can you add', 'improvement', 'enhance', 'new feature', 'wish list', 'roadmap']
      }
    ];

    for (const rule of rules) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword)) {
          return rule.category;
        }
      }
    }

    return 'general';
  }

  /**
   * Auto-determine priority from category and keywords
   */
  autoPriority(category, subject, description) {
    const text = `${subject} ${description}`.toLowerCase();

    // Urgent keywords
    if (text.includes('urgent') || text.includes('critical') || text.includes('asap') || text.includes('emergency')) {
      return 'urgent';
    }

    // Category-based defaults
    const highPriority = ['payment_failed', 'settlement_delayed'];
    if (highPriority.includes(category)) return 'high';

    const mediumPriority = ['pricing_issue', 'account_issue'];
    if (mediumPriority.includes(category)) return 'medium';

    return 'low';
  }

  // ─── Ticket Lifecycle ──────────────────────────────────────────────────

  /**
   * Create a new ticket with auto-categorization and initial system message
   */
  async createTicket({ userWallet, paymentId, subject, description, category, priority }) {
    // Auto-categorize if not provided
    const resolvedCategory = category || this.autoCategory(subject, description);
    const resolvedPriority = priority || this.autoPriority(resolvedCategory, subject, description);

    // Auto-assign to merchant if payment_id is linked
    let assignedMerchantId = null;
    if (paymentId) {
      try {
        const payment = await this.db.payments.findById(paymentId);
        if (payment && payment.merchant_identifier) {
          assignedMerchantId = payment.merchant_identifier;
        }
      } catch (err) {
        // Ignore | payment lookup is best-effort
      }
    }

    // Create the ticket
    const ticket = await this.db.supportTickets.create({
      userWallet,
      paymentId,
      category: resolvedCategory,
      priority: resolvedPriority,
      subject,
      description,
      assignedMerchantId
    });

    // Add initial system message
    await this.db.supportTickets.addMessage(ticket.id, {
      senderType: 'system',
      senderName: 'PharosPay Support',
      message: `Ticket ${ticket.ticket_number} created. Category: ${this._formatCategory(resolvedCategory)}. Priority: ${resolvedPriority.toUpperCase()}. Our support team will review your request shortly.`
    });

    // Add the user's description as the first user message
    if (description) {
      await this.db.supportTickets.addMessage(ticket.id, {
        senderType: 'user',
        senderName: this._shortenWallet(userWallet),
        message: description
      });
    }

    return ticket;
  }

  /**
   * Add a reply to an existing ticket thread
   */
  async addReply(ticketId, message, senderType = 'user', senderName) {
    const ticket = await this.db.supportTickets.findById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    // If ticket was closed, reopen it on user reply
    if (ticket.status === 'closed' && senderType === 'user') {
      await this.db.supportTickets.updateStatus(ticketId, 'open');
    }

    // If ticket is open and agent replies, mark as in_progress
    if (ticket.status === 'open' && senderType === 'agent') {
      await this.db.supportTickets.updateStatus(ticketId, 'in_progress');
    }

    const name = senderName || (senderType === 'user'
      ? this._shortenWallet(ticket.user_wallet)
      : senderType === 'agent'
        ? 'Support Agent'
        : 'PharosPay System');

    return await this.db.supportTickets.addMessage(ticketId, {
      senderType,
      senderName: name,
      message
    });
  }

  /**
   * Resolve a ticket with a resolution message
   */
  async resolveTicket(ticketId, resolution) {
    const ticket = await this.db.supportTickets.findById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    // Add resolution message
    await this.db.supportTickets.addMessage(ticketId, {
      senderType: 'system',
      senderName: 'PharosPay Support',
      message: `✅ Ticket resolved. ${resolution || 'Issue has been addressed.'}`
    });

    return await this.db.supportTickets.updateStatus(ticketId, 'resolved');
  }

  /**
   * Close a ticket permanently
   */
  async closeTicket(ticketId) {
    const ticket = await this.db.supportTickets.findById(ticketId);
    if (!ticket) throw new Error('Ticket not found');

    await this.db.supportTickets.addMessage(ticketId, {
      senderType: 'system',
      senderName: 'PharosPay Support',
      message: '🔒 Ticket closed.'
    });

    return await this.db.supportTickets.updateStatus(ticketId, 'closed');
  }

  /**
   * Get full ticket with messages and linked payment info
   */
  async getTicketDetail(ticketId) {
    const ticket = await this.db.supportTickets.findById(ticketId);
    if (!ticket) return null;

    const messages = await this.db.supportTickets.getMessages(ticketId);

    let linkedPayment = null;
    if (ticket.payment_id) {
      try {
        linkedPayment = await this.db.payments.findById(ticket.payment_id);
      } catch (err) {
        // Ignore | linked payment is optional context
      }
    }

    return {
      ...ticket,
      messages,
      linkedPayment
    };
  }

  /**
   * Get support statistics
   */
  async getStats() {
    return await this.db.supportTickets.getStats();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  _shortenWallet(wallet) {
    if (!wallet || wallet.length < 10) return wallet || 'Unknown';
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  }

  _formatCategory(category) {
    const labels = {
      payment_failed: 'Payment Failed',
      settlement_delayed: 'Settlement Delayed',
      pricing_issue: 'Pricing Issue',
      account_issue: 'Account Issue',
      feature_request: 'Feature Request',
      general: 'General Inquiry'
    };
    return labels[category] || category;
  }
}

module.exports = TicketManager;
