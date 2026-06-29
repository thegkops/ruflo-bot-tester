// Adapter: OpenAI-compatible endpoints (OpenAI, Ollama, Azure OpenAI, LM Studio, etc.)
export class OpenAIAdapter {
  constructor(config) {
    this.model       = config.model || 'gpt-4o-mini';
    this.apiKey      = config.api_key || process.env.OPENAI_API_KEY || 'sk-placeholder';
    this.endpoint    = config.endpoint || 'https://api.openai.com/v1/chat/completions';
    this.systemPrompt= config.system_prompt || '';
    this.maxTokens   = config.max_tokens || 1024;
    this.temperature = config.temperature ?? 0.7;
  }

  async send(messages) {
    const start = Date.now();
    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        ...(this.systemPrompt ? [{ role: 'system', content: this.systemPrompt }] : []),
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API ${res.status}: ${err}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      latency_ms: Date.now() - start,
      tokens: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens },
    };
  }
}
