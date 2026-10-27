/** POST /api/plan {...context, level} → Nemotron (reasoning) streams the plan as Server-Sent Events. */
import { HttpError, readJson, route, rateLimit } from './_lib/http.js';
import { MODELS, chatStream } from './_lib/nebius.js';
import { planMessages } from './_lib/prompts.js';

export default route(['POST'], async (req, res) => {
  rateLimit(req, 'plan', 15, 60 * 60 * 1000);
  const { issue, repo, files = [], docs = [], guides = {}, level = 'new', tree = [] } = await readJson(req);
  if (!issue?.title || !repo?.fullName) throw new HttpError(400, 'Missing issue details. Start again from the issue link.');

  const stream = chatStream({ model: MODELS.smart, messages: planMessages({ issue, repo, files, docs, guides, level, tree }) });
  // Start the model call before sending headers so setup errors still come back as normal JSON
  const first = await stream.next();

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const emit = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  emit({ type: 'start', model: MODELS.smart });

  let lastThinking = 0;
  const forward = (ev) => {
    if (ev.type === 'thinking') {
      const now = Date.now();
      if (now - lastThinking > 700) {
        lastThinking = now;
        emit({ type: 'thinking' });
      }
    } else emit(ev);
  };
  if (!first.done) forward(first.value);
  for await (const ev of stream) forward(ev);
  emit({ type: 'done' });
  res.end();
});
