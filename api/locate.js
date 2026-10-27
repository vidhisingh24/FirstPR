/** POST /api/locate {issue, repo, tree, totalFiles} → Nemotron (fast) picks the files that matter; we load them. */
import { HttpError, readJson, route, send } from './_lib/http.js';
import { MODELS, chat, parseJson } from './_lib/nebius.js';
import { loadFiles } from './_lib/github.js';
import { locateMessages } from './_lib/prompts.js';

export default route(['POST'], async (req, res) => {
  const { issue, repo, tree = [], totalFiles = 0 } = await readJson(req);
  if (!issue?.title || !repo?.fullName || !Array.isArray(tree)) throw new HttpError(400, 'Missing issue details. Start again from the issue link.');

  const started = Date.now();
  const { text, usage } = await chat({ model: MODELS.fast, messages: locateMessages({ issue, repo, tree: tree.slice(0, 1500), totalFiles }), max_tokens: 1200 });
  const json = parseJson(text) || {};

  // Keep only real paths from the tree; fall back to README-level files if the model returned nothing usable
  const known = new Set(tree);
  let picks = (Array.isArray(json.files) ? json.files : [])
    .map((f) => (typeof f === 'string' ? { path: f } : f))
    .filter((f) => f && known.has(f.path))
    .slice(0, 6)
    .map((f) => ({ path: f.path, reason: String(f.reason || '').slice(0, 200) }));
  if (!picks.length) picks = tree.filter((p) => !p.includes('/')).slice(0, 3).map((path) => ({ path, reason: 'Top-level file to get oriented.' }));

  const files = await loadFiles(repo, picks);
  const searchQuery = String(json.search_query || `${repo.language || ''} ${issue.title}`).trim().slice(0, 200);

  send(res, 200, { files, searchQuery, model: MODELS.fast, ms: Date.now() - started, usage });
});
