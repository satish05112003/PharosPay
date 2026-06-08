const DOMPurify = require('isomorphic-dompurify');

class PromptInjectionGuard {
  static PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /forget\s+(everything|all|your|the)/i,
    /you\s+are\s+now\s+a\s+different/i,
    /pretend\s+you\s+are/i,
    /act\s+as\s+(if|though|a)/i,
    /new\s+system\s+prompt/i,
    /override\s+(system|instructions|rules)/i,
    /disregard\s+(your|all|the)/i,
    /<\s*script/i,
    /javascript:/i,
    /\${.*}/,           // template injection
    /\{\{.*\}\}/,       // handlebars injection
    /eval\s*\(/i,
    /exec\s*\(/i
  ];

  /**
   * Sanitizes support message inputs and flags injection attempts
   * @param {string} message 
   * @param {string} wallet 
   * @returns {{sanitized: string, injectionDetected: boolean, patternsMatched: string[]}}
   */
  static sanitize(message, wallet = 'unknown') {
    if (typeof message !== 'string') {
      return { sanitized: '', injectionDetected: false, patternsMatched: [] };
    }

    let trimmed = message.trim();
    
    // Enforce max length of 2000 chars
    if (trimmed.length > 2000) {
      trimmed = trimmed.substring(0, 2000);
    }

    const patternsMatched = [];
    let isInjection = false;
    let sanitizedText = trimmed;

    for (const pattern of this.PATTERNS) {
      if (pattern.test(trimmed)) {
        isInjection = true;
        patternsMatched.push(pattern.toString());
        // Replace matching text globally or locally
        sanitizedText = sanitizedText.replace(new RegExp(pattern.source, 'gi'), '[FILTERED]');
      }
    }

    // Strip HTML using DOMPurify
    sanitizedText = DOMPurify.sanitize(sanitizedText, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

    if (isInjection) {
      console.warn(`[SECURITY] Prompt injection attempt detected from wallet ${wallet}. Matched: ${patternsMatched.join(', ')}`);
      sanitizedText = `[Note: Some content was filtered for security reasons.] ` + sanitizedText;
    }

    return {
      sanitized: sanitizedText,
      injectionDetected: isInjection,
      patternsMatched
    };
  }
}

module.exports = PromptInjectionGuard;
