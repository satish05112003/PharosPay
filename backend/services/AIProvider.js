class AIProvider {
  constructor() {
    this.provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
    this.timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT || '30000', 10);
    this.enabled = false;
    this.reason = '';
    this.model = '';

    this.validateConfig();
  }

  validateConfig() {
    if (this.provider === 'openrouter') {
      this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
      if (!process.env.OPENROUTER_API_KEY) {
        this.enabled = false;
        this.reason = 'Missing OPENROUTER_API_KEY';
      } else {
        this.enabled = true;
      }
    } else if (this.provider === 'grok') {
      this.model = process.env.GROK_MODEL || 'grok-2-1212';
      if (!process.env.GROK_API_KEY) {
        this.enabled = false;
        this.reason = 'Missing GROK_API_KEY';
      } else {
        this.enabled = true;
      }
    } else {
      this.enabled = false;
      this.reason = `Invalid provider: ${this.provider}`;
    }

    if (!this.enabled) {
      console.warn(`\n⚠️  [AI SUPPORT DISABLED]`);
      console.warn(`   No AI provider API key configured. Reason: ${this.reason}\n`);
    } else {
      console.log(`\n🤖 [AI SUPPORT ENABLED]`);
      console.log(`   [PROVIDER] Used: ${this.provider.toUpperCase()}`);
      console.log(`   [PROVIDER] Model: ${this.model}\n`);
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      provider: this.provider,
      model: this.model,
      reason: this.enabled ? null : this.reason
    };
  }

  async getCompletion(messages) {
    if (!this.enabled) {
      throw new Error('No AI provider API key configured.');
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let url = '';
    let headers = {
      'Content-Type': 'application/json'
    };
    let body = {};

    if (this.provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
      headers['HTTP-Referer'] = 'https://pharospay.xyz';
      headers['X-Title'] = 'PharosPay AI Support';
      
      body = {
        model: this.model,
        messages: messages,
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.25'),
        max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '1200', 10)
      };
    } else if (this.provider === 'grok') {
      url = 'https://api.x.ai/v1/chat/completions';
      headers['Authorization'] = `Bearer ${process.env.GROK_API_KEY}`;
      
      body = {
        model: this.model,
        messages: messages,
        temperature: parseFloat(process.env.GROK_TEMPERATURE || '0.25'),
        max_tokens: parseInt(process.env.GROK_MAX_TOKENS || '1200', 10)
      };
    }

    console.log(`[AI REQUEST] Provider: ${this.provider.toUpperCase()}, Model: ${this.model}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI ERROR] Provider: ${this.provider.toUpperCase()} returned status ${response.status}:`, errorText);
        throw new Error(`AI Provider API Error: ${response.statusText || response.status}`);
      }

      const resJson = await response.json();
      const answer = resJson.choices?.[0]?.message?.content;

      if (!answer) {
        console.error('[AI ERROR] Choices were empty:', JSON.stringify(resJson));
        throw new Error('AI Provider returned empty response.');
      }

      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;

      console.log(`[AI RESPONSE] Provider: ${this.provider.toUpperCase()}, Model: ${this.model}, Latency: ${latency}ms, Tokens: ${promptTokens + completionTokens}`);

      return {
        answer,
        modelUsed: this.model,
        processingMs: latency,
        promptTokens,
        completionTokens
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      if (err.name === 'AbortError' || err.message === 'The user aborted a request.') {
        console.error(`[AI ERROR] Provider: ${this.provider.toUpperCase()} timed out after ${this.timeoutMs}ms.`);
        throw new Error('AI provider timeout');
      }
      console.error(`[AI ERROR] Provider: ${this.provider.toUpperCase()} failed:`, err.message);
      throw err;
    }
  }
}

module.exports = new AIProvider();
