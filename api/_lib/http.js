/** Small helpers shared by the API routes (work on Vercel and in the local Vite dev server). */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// Best-effort per-IP limit so a public demo can't burn through the API credits.
const hits = new Map();
export function rateLimit(req, name, limit, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  const key = `${name}:${ip}`;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) throw new HttpError(429, 'Too many requests from your network. Please wait a few minutes.');
  list.push(now);
  hits.set(key, list);
}

/** Wraps a route: method check + friendly JSON errors. */
export const route = (methods, fn) => async (req, res) => {
  if (!methods.includes(req.method)) return send(res, 405, { error: 'Method not allowed' });
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500 && !err.status) console.error(err);
    const message = err.status ? err.message : 'Something went wrong. Please try again.';
    if (!res.headersSent) return send(res, status, { error: message });
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      res.end();
    } catch {
      /* stream already closed */
    }
  }
};
