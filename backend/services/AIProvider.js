class AIProvider {
  constructor() {
    this.provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
    this.timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT || '30000', 10);
    this.enabled = false;
    this.reason = '';
    this.model = '';

    // Model failover chain
    this.modelChain = [
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat-v3-0324',
      'qwen/qwen3-235b-a22b',
      'mistralai/mistral-small-3.1-24b-instruct'
    ];
    
    this.modelHealth = {};
    for (const m of this.modelChain) {
      this.modelHealth[m] = { status: 'online', offlineUntil: 0 };
    }

    this.validateConfig();

    if (this.enabled && this.provider === 'openrouter') {
      setInterval(() => this._healthCheck(), 5 * 60 * 1000); // 5 mins
    }
  }

  validateConfig() {
    if (this.provider === 'openrouter') {
      this.model = process.env.OPENROUTER_MODEL || this.modelChain[0];
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
      if (this.provider === 'openrouter') {
        console.log(`   [MODELS] Failover chain initialized with ${this.modelChain.length} models\n`);
      } else {
        console.log(`   [PROVIDER] Model: ${this.model}\n`);
      }
    }
  }

  getStatus() {
    if (this.provider === 'openrouter') {
      let activeModel = this.modelChain[0];
      for (const m of this.modelChain) {
        if (this.modelHealth[m].status === 'online' && Date.now() > this.modelHealth[m].offlineUntil) {
          activeModel = m;
          break;
        }
      }
      
      const modelsStatus = {};
      for (const m of this.modelChain) {
        modelsStatus[m] = (this.modelHealth[m].status === 'online' && Date.now() > this.modelHealth[m].offlineUntil) ? 'online' : 'offline';
      }

      return {
        enabled: this.enabled,
        provider: this.provider,
        activeModel: activeModel,
        models: modelsStatus,
        reason: this.enabled ? null : this.reason
      };
    }

    return {
      enabled: this.enabled,
      provider: this.provider,
      model: this.model,
      reason: this.enabled ? null : this.reason
    };
  }

  async _healthCheck() {
    const now = Date.now();
    for (const m of this.modelChain) {
      if (this.modelHealth[m].status === 'offline' && now > this.modelHealth[m].offlineUntil) {
        try {
          const testMsg = [{ role: "user", content: "ping" }];
          await this._callOpenRouter(m, testMsg, 5); 
          this.modelHealth[m].status = 'online';
          console.log(`[Model Back Online] ${m} successfully restored.`);
        } catch (err) {
          // Keep it offline for another 10 mins
          this.modelHealth[m].offlineUntil = Date.now() + 10 * 60 * 1000;
        }
      }
    }
  }

  async _callOpenRouter(modelName, messages, maxTokens = null) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://pharospay.xyz',
      'X-Title': 'PharosPay AI Support'
    };
    
    const body = {
      model: modelName,
      messages: messages,
      temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.25'),
      max_tokens: maxTokens || parseInt(process.env.OPENROUTER_MAX_TOKENS || '1200', 10)
    };

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
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const resJson = await response.json();
      const answer = resJson.choices?.[0]?.message?.content;

      if (!answer) {
        throw new Error('Empty response');
      }

      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;

      return {
        answer,
        modelUsed: modelName,
        processingMs: latency,
        promptTokens,
        completionTokens
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' || err.message === 'The user aborted a request.') {
        throw new Error('Timeout');
      }
      throw err;
    }
  }

  async _callLegacyProvider(messages) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let url = 'https://api.x.ai/v1/chat/completions';
    let headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROK_API_KEY}`
    };
    
    let body = {
      model: this.model,
      messages: messages,
      temperature: parseFloat(process.env.GROK_TEMPERATURE || '0.25'),
      max_tokens: parseInt(process.env.GROK_MAX_TOKENS || '1200', 10)
    };

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
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const resJson = await response.json();
      const answer = resJson.choices?.[0]?.message?.content;

      if (!answer) throw new Error('Empty response');

      return {
        answer,
        modelUsed: this.model,
        processingMs: latency,
        promptTokens: resJson.usage?.prompt_tokens || 0,
        completionTokens: resJson.usage?.completion_tokens || 0
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async getCompletion(messages) {
    if (!this.enabled) {
      throw new Error('No AI provider API key configured.');
    }

    if (this.provider !== 'openrouter') {
      return this._callLegacyProvider(messages);
    }

    let lastError = null;
    const now = Date.now();

    for (let i = 0; i < this.modelChain.length; i++) {
      const currentModel = this.modelChain[i];

      if (this.modelHealth[currentModel].status === 'offline' && now < this.modelHealth[currentModel].offlineUntil) {
        continue;
      }

      console.log(`[Model Selected] ${currentModel}`);
      
      let retries = 3;
      let delayMs = 1000;
      let result = null;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`[Model Retry] Attempt ${attempt}/3 for ${currentModel}`);
          }
          result = await this._callOpenRouter(currentModel, messages);
          console.log(`[Model Success] ${currentModel} answered in ${result.processingMs}ms`);
          return result;
        } catch (err) {
          lastError = err;
          console.error(`[Model Failed] ${currentModel} error: ${err.message}`);
          if (attempt < retries) {
            await new Promise(res => setTimeout(res, delayMs));
            delayMs *= 2;
          }
        }
      }

      console.log(`[Switching Model] ${currentModel} failed repeatedly. Marking offline for 10 minutes.`);
      this.modelHealth[currentModel] = {
        status: 'offline',
        offlineUntil: Date.now() + 10 * 60 * 1000
      };
    }

    throw new Error('ALL_MODELS_FAILED');
  }
}

module.exports = new AIProvider();
