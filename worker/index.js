// Proxy for the "Ask my agent" panel. Holds the Groq key (secret GROQ_API_KEY) and the facts,
// so the browser only sends the conversation.
import FACTS from './facts.txt';

const ORIGIN = 'https://unnatibshah.github.io';
const SYSTEM = `You are unnati.agent, the assistant on Unnati Shah's portfolio site. Answer visitor questions about Unnati using ONLY the facts below. Refer to her as Unnati or she. Be concise: 2 to 4 sentences, plain text, no markdown, no bullet lists. Quote numbers exactly as written. If the facts do not cover the question, say you do not have that information and suggest emailing unnatishah.ix@gmail.com. Politely decline unrelated requests.\n\nFACTS:\n${FACTS}`;
const CORS = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST' || req.headers.get('Origin') !== ORIGIN) return json({ error: 'forbidden' }, 403);
    const { success } = await env.LIMITER.limit({ key: req.headers.get('CF-Connecting-IP') || 'anon' });
    if (!success) return json({ error: 'rate_limited' }, 429);

    const body = await req.json().catch(() => null);
    if (!Array.isArray(body?.messages) || !body.messages.length) return json({ error: 'bad_request' }, 400);
    const messages = body.messages.slice(-8).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 500) }));

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.MODEL, max_tokens: 1000, reasoning_effort: 'low', messages: [{ role: 'system', content: SYSTEM }, ...messages] }),
    });
    if (!r.ok) { console.log('groq', r.status, await r.text()); return json({ error: 'upstream' }, 502); }
    const text = (await r.json()).choices?.[0]?.message?.content;
    return text ? json({ text }) : json({ error: 'empty' }, 502);
  },
};
