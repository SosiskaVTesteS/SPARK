/**
 * SPARK AI Filter — Cloudflare Worker
 *
 * Uses Cloudflare Workers AI (Llama 3.1 8B) for content moderation.
 * No external API calls — runs natively within Cloudflare infrastructure.
 * Free tier: 10,000 requests/day, zero rate-limiting issues.
 *
 * Bindings (wrangler.toml):
 *   [ai] binding = "AI"
 *
 * Secrets (wrangler secret put):
 *   FILTER_TOKEN — shared secret, must match CF_FILTER_TOKEN in moderate-content
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-filter-token',
};

const SYSTEM_PROMPT = `You are a strict content moderation system for a social platform. Analyze the text and determine if it violates the rules.

PROHIBITED (return {"allowed":false}):
- Drugs, narcotics, drug sales, drug stash/drop points ("закладки")
- Pornography, explicit sexual content
- Extremism, terrorism, calls for violence
- Illegal weapons
- Spam, promotion of Telegram channels/bots/external services
- Hate speech (race, religion, gender)
- Financial scams, pyramid schemes, unrealistic profit promises

ALLOWED (return {"allowed":true}):
- Business ideas, startups, technology
- Education, science, creative content
- Social commentary without incitement

Respond ONLY with valid JSON, nothing else:
{"allowed": boolean, "reason": "short reason in Russian, or ok if allowed"}`;

function extractJson(raw) {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*?\}/);
  if (m) {
    try {
      const p = JSON.parse(m[0]);
      if (typeof p.allowed === 'boolean') return p;
    } catch {}
  }
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ message: 'Method not allowed' }), {
        status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Shared-secret auth
    const token = request.headers.get('x-filter-token') || '';
    if (!env.FILTER_TOKEN || token !== env.FILTER_TOKEN) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    let text = '';
    try {
      const body = await request.json();
      text = (body.text || '').trim();
    } catch {
      return new Response(JSON.stringify({ message: 'Invalid body' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!text) {
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    try {
      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        max_tokens: 120,
        temperature: 0,
      });

      const raw     = response?.response ?? '';
      const verdict = extractJson(raw);

      if (!verdict) {
        console.warn('[spark-ai-filter] parse failed:', raw.slice(0, 100));
        return new Response(JSON.stringify({ allowed: true }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      if (verdict.allowed === false) {
        return new Response(JSON.stringify({ allowed: false, reason: verdict.reason || 'content_policy_violation' }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('[spark-ai-filter] AI error:', e);
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  },
};
