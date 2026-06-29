// Adapter: Anthropic Claude bots
export class AnthropicAdapter {
  constructor(config) {
    this.model    = config.model || 'claude-haiku-4-5-20251001';
    this.apiKey   = config.api_key || process.env.ANTHROPIC_API_KEY;
    this.systemPrompt = config.system_prompt || '';
    this.maxTokens    = config.max_tokens || 1024;
  }

  async send(messages) {
    const start = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (res.status === 401) {
      throw new Error('Anthropic API key missing or invalid — set ANTHROPIC_API_KEY to test this bot');
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${err}`);
    }

    const data = await res.json();
    return {
      content: data.content[0]?.text || '',
      latency_ms: Date.now() - start,
      tokens: { input: data.usage?.input_tokens, output: data.usage?.output_tokens },
    };
  }
}
