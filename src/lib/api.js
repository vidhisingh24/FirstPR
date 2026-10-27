/** Calls to our own /api routes. */

export async function postJson(path, body, signal) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || `Request failed (${r.status})`);
  return json;
}

/** POSTs and reads a Server-Sent Events stream, calling onEvent for each event. */
export async function postStream(path, body, onEvent, signal) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.includes('text/event-stream')) {
    const json = await r.json().catch(() => ({}));
    throw new Error(json.error || `Request failed (${r.status})`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const event = JSON.parse(line.slice(5).trim());
      if (event.type === 'error') throw new Error(event.message);
      onEvent(event);
    }
  }
}
