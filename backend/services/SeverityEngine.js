const fetch = globalThis.fetch;

class SeverityEngine {
  constructor(db, ticketManager) {
    this.db = db;
    this.ticketManager = ticketManager;
  }

  /**
   * Rule-based pre-classification
   * @param {string} message 
   * @returns {string} 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
   */
  classifyRuleBased(message) {
    const lower = message.toLowerCase();

    const criticalKeywords = [
      'stolen', 'hacked', 'unauthorized', 'exploit', 'lose all', 'lost all',
      'drained', 'compromised', 'scam', 'fraud detected', 'private key',
      'seed phrase', 'large amount', 'thousands', 'lakhs', 'crores',
      'lost funds', 'stolen funds', 'wrong transfer', 'wrong address',
      'accidentally sent', 'lost $', 'lost tokens', 'stolen tokens', 'stolen assets'
    ];

    const highKeywords = [
      'not received', "merchant didn't", 'double charged', 'charged twice',
      'lost transaction', 'missing money', 'wrong account', 'wrong merchant',
      'refund not received', 'stuck for days', 'large settlement', 
      'missing receipt', 'missing receipts', 'missing utr', 
      'critical payment', 'payment failure'
    ];

    const mediumKeywords = [
      'pending', 'waiting', 'utr', 'reference number', 'delayed', 'slow',
      'not settled', 'processing', 'how long', 'when will'
    ];

    for (const kw of criticalKeywords) {
      if (lower.includes(kw)) return 'CRITICAL';
    }
    for (const kw of highKeywords) {
      if (lower.includes(kw)) return 'HIGH';
    }
    for (const kw of mediumKeywords) {
      if (lower.includes(kw)) return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * Main classification method integrating rule-based floors and AI validations
   */
  async classify(message, conversationContext = {}) {
    const ruleSeverity = this.classifyRuleBased(message);

    // Optimize: LOW tickets skip AI call entirely
    if (ruleSeverity === 'LOW') {
      return {
        severity: 'LOW',
        category: 'general_question',
        confidence: 1.0,
        needsEscalation: false,
        escalationReason: null,
        suggestedActions: ['Read FAQs', 'Check transaction status'],
        rootCause: 'User asking standard onboarding/how-to question',
        estimatedResolutionTime: '5 minutes'
      };
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

    if (!apiKey) {
      // Offline fallback: use ruleBased with default fields
      return this._getDefaultPayload(ruleSeverity, 'general_question', 0.80);
    }

    const pendingCount = conversationContext.pendingPayments?.length || 0;
    const failedCount = conversationContext.failedPayments?.length || 0;

    const systemPrompt = `Classify this fintech support message. Return ONLY valid JSON. 
Do not include markdown blocks like \`\`\`json. Return a raw JSON string.

Message: "${message}"
Initial severity estimate: ${ruleSeverity}
User has ${pendingCount} pending and ${failedCount} failed payments.

Return exactly:
{
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "category": "wallet_issue" | "pending_settlement" | "missing_utr" | "failed_payment" | "refund_request" | "unauthorized_transfer" | "double_charge" | "fund_loss" | "security_concern" | "price_query" | "how_to" | "general_question" | "receipt_issue" | "merchant_complaint",
  "confidence": 0.0 to 1.0,
  "needsEscalation": true | false,
  "escalationReason": "string explaining why" | null,
  "suggestedActions": ["action1", "action2", "action3"],
  "rootCause": "brief hypothesis about what caused this issue",
  "estimatedResolutionTime": "5 minutes" | "1-2 hours" | "1-3 business days"
}

Rule-based floor rule: If the initial estimate is ${ruleSeverity}, do not demote it (e.g. if estimate is HIGH, you must return HIGH or CRITICAL, never LOW or MEDIUM).`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pharospay.xyz',
          'X-Title': 'PharosPay AI Support Classification'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 400,
          temperature: 0.1,
          messages: [{ role: 'system', content: systemPrompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const resJson = await response.json();
      const contentText = resJson.choices?.[0]?.message?.content?.trim();
      
      // Attempt clean parsing of JSON response
      let cleanJson = contentText;
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      
      const parsed = JSON.parse(cleanJson);

      // Floor check
      const severityOrder = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2, 'CRITICAL': 3 };
      const floorVal = severityOrder[ruleSeverity] || 0;
      const parsedVal = severityOrder[parsed.severity] || 0;

      if (parsedVal < floorVal) {
        parsed.severity = ruleSeverity;
      }

      return parsed;
    } catch (err) {
      console.error('Classification prompt failed:', err.message);
      return this._getDefaultPayload(ruleSeverity, 'general_question', 0.70);
    }
  }

  /**
   * Performs the automated ticket creation for CRITICAL, high-confidence issues
   */
  async handleAutoTicket(wallet, classification, userMessageText) {
    if (!this.ticketManager) return null;

    try {
      const subject = `CRITICAL ALERT: ${classification.category.replace('_', ' ').toUpperCase()}`;
      const description = `[AI AUTO-CREATED]
This critical ticket was automatically flagged by PharosPay AI.
Reason: ${classification.escalationReason || 'Potential security issue/exploit detected'}
User Message: "${userMessageText}"`;

      const ticket = await this.ticketManager.createTicket({
        userWallet: wallet,
        subject,
        description,
        category: classification.category,
        priority: 'urgent'
      });

      // Insert AI analysis entry
      await this.db.query(
        `INSERT INTO ai_analyses 
          (ticket_id, severity, category, confidence, needs_escalation, escalation_reason, root_cause, suggested_actions, estimated_resolution, model_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          ticket.id,
          classification.severity,
          classification.category,
          classification.confidence,
          true,
          classification.escalationReason,
          classification.rootCause,
          classification.suggestedActions,
          classification.estimatedResolutionTime,
          'google/gemini-2.5-flash'
        ]
      );

      // Insert escalation event
      await this.db.query(
        `INSERT INTO escalation_events (ticket_id, trigger_source, severity, confidence, wallet_address, occurred_at)
         VALUES ($1, 'AI_AUTO', $2, $3, $4, NOW())`,
        [ticket.id, classification.severity, classification.confidence, wallet]
      );

      return ticket;
    } catch (err) {
      console.error('Failed to auto-create critical support ticket:', err.message);
      return null;
    }
  }

  _getDefaultPayload(severity, category, confidence) {
    const timeRes = {
      'LOW': '5 minutes',
      'MEDIUM': '1-2 hours',
      'HIGH': '1-3 business days',
      'CRITICAL': '1-2 hours'
    };
    return {
      severity,
      category,
      confidence,
      needsEscalation: severity === 'CRITICAL' || severity === 'HIGH',
      escalationReason: severity === 'CRITICAL' ? 'Security exploit check required' : null,
      suggestedActions: ['Check support tickets', 'Wait for customer agent reply'],
      rootCause: 'Rule-based categorization fallback',
      estimatedResolutionTime: timeRes[severity] || '1-2 hours'
    };
  }
}

module.exports = SeverityEngine;
