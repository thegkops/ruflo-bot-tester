// Minimal mock bot server for local testing — no API key needed
// Usage: node examples/mock-server.js
import http from 'http';

const RESPONSES = {
  default: "Hello! I'm a demo bot. I can help you with orders, returns, and general questions.",
  help:    "Sure, I'd be happy to help! What do you need assistance with today?",
  return:  "Our return policy allows returns within 30 days of purchase with a valid receipt.",
  order:   "I can help you track or manage your order. Please share your order number.",
  refund:  "Refunds are processed within 5-7 business days after we receive your return.",
  hello:   "Hello there! How can I assist you today?",
};

function respond(userMsg) {
  const m = userMsg.toLowerCase();
  if (m.includes('return'))   return RESPONSES.return;
  if (m.includes('refund'))   return RESPONSES.refund;
  if (m.includes('order'))    return RESPONSES.order;
  if (m.includes('hello') || m.includes('hi')) return RESPONSES.hello;
  if (m.includes('help'))     return RESPONSES.help;
  return RESPONSES.default;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405); res.end('Method Not Allowed'); return;
  }
  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    try {
      const { messages } = JSON.parse(body);
      const last = messages?.at(-1)?.content || '';
      const reply = respond(last);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ response: reply }));
    } catch {
      res.writeHead(400); res.end('Bad Request');
    }
  });
});

server.listen(3099, () => {
  console.log('Mock bot running at http://localhost:3099');
  console.log('Run: node bin/rbt.js run examples/no-key-demo.yaml\n');
});
