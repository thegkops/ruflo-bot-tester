// Adapter: generic HTTP bot endpoint
// POST JSON { messages: [{role, content}] } → { response: "..." }
// Configure response_path to extract from nested JSON, e.g. "data.reply"
export class HttpAdapter {
  constructor(config) {
    this.endpoint    = config.endpoint;
    this.headers     = config.headers || {};
    this.responsePath= config.response_path || 'response';
    this.systemPrompt= config.system_prompt || '';
  }

  async send(messages) {
    if (!this.endpoint) throw new Error('HTTP adapter requires endpoint');
    const start = Date.now();

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.headers },
      body: JSON.stringify({ messages, system: this.systemPrompt }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP bot ${res.status}: ${err}`);
    }

    const data = await res.json();
    const content = this.responsePath.split('.').reduce((o, k) => o?.[k], data) || '';
    return { content: String(content), latency_ms: Date.now() - start, tokens: {} };
  }
}
