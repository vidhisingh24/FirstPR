/**
 * NVIDIA Nemotron models served by Nebius Token Factory (OpenAI-compatible API).
 * - fast:  Nemotron 3 Super → quick, cheap step (pick the right files)
 * - smart: Nemotron 3 Ultra → the long reasoning step (write the plan and the draft fix)
 */
import { HttpError } from './http.js';

const BASE = (process.env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1').replace(/\/$/, '');

export const MODELS = {
  fast: process.env.NEBIUS_FAST_MODEL || 'nvidia/nemotron-3-super-120b-a12b',
  smart: process.env.NEBIUS_SMART_MODEL || 'nvidia/Nemotron-3-Ultra-550b-a55b',
};

function apiKey() {
  const key = process.env.NEBIUS_API_KEY;
  if (!key) throw new HttpError(500, 'The server is missing NEBIUS_API_KEY.');
  return key;
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.ok) return r;
  const detail = (await r.text().catch(() => '')).slice(0, 300);
  if (r.status === 401 || r.status === 403) throw new HttpError(502, 'Nebius Token Factory rejected the API key.');
  if (r.status === 402) throw new HttpError(503, 'The Nebius Token Factory account is out of credits.');
  if (r.status === 429) throw new HttpError(503, 'Nebius Token Factory is busy right now. Please try again in a minute.');
  if (r.status === 404 || /model/i.test(detail)) throw new HttpError(502, `Token Factory couldn’t run the model “${body.model}”. Check the model ID (open /api/health).`);
  throw new HttpError(502, `Nebius Token Factory returned an error (${r.status}).`);
}

/** Removes reasoning blocks some models put inside the answer. */
export const stripThink = (s) => String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();

/** Pulls the first JSON object out of a model reply. */
export function parseJson(s) {
  const text = stripThink(s).replace(/```(?:json)?/gi, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function chat({ model, messages, temperature = 0.2, max_tokens = 1500 }) {
  const r = await post('/chat/completions', { model, messages, temperature, max_tokens });
  const json = await r.json();
  return { text: stripThink(json.choices?.[0]?.message?.content), usage: json.usage || null };
}

/**
 * Streams a completion. Yields {type:'thinking'} while the model reasons and
 * {type:'token', text} for answer text (any <think>…</think> is filtered out).
 */
export async function* chatStream({ model, messages, temperature = 0.3, max_tokens = 6000 }) {
  const r = await post('/chat/completions', { model, messages, temperature, max_tokens, stream: true });
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inThink = false;
  let carry = '';

  // Filter <think> blocks that can be split across chunks
  function* filter(text) {
    carry += text;
    for (;;) {
      if (inThink) {
        const end = carry.toLowerCase().indexOf('</think>');
        if (end < 0) {
          carry = carry.slice(-8);
          yield { type: 'thinking' };
          return;
        }
        carry = carry.slice(end + 8);
        inThink = false;
      } else {
        const start = carry.toLowerCase().indexOf('<think>');
        if (start < 0) {
          const safe = carry.length > 7 ? carry.slice(0, -7) : '';
          if (safe) yield { type: 'token', text: safe };
          carry = carry.slice(safe.length);
          return;
        }
        if (start > 0) yield { type: 'token', text: carry.slice(0, start) };
        carry = carry.slice(start + 7);
        inThink = true;
      }
    }
  }

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') {
        if (!inThink && carry) yield { type: 'token', text: carry };
        return;
      }
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = json.choices?.[0]?.delta || {};
      if (delta.reasoning_content || delta.reasoning) yield { type: 'thinking' };
      if (delta.content) yield* filter(delta.content);
      if (json.usage) yield { type: 'usage', usage: json.usage };
    }
  }
  if (!inThink && carry) yield { type: 'token', text: carry };
}

/** Lists the NVIDIA models this API key can use (for /api/health). */
export async function listNvidiaModels() {
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${apiKey()}` } });
  if (!r.ok) throw new HttpError(502, `Couldn’t list models (${r.status}).`);
  const json = await r.json();
  return (json.data || []).map((m) => m.id).filter((id) => /nvidia|nemotron/i.test(id));
}
