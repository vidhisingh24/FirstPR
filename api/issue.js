/** POST /api/issue {url} → the issue, its repo, the file list and repo guides. */
import { readJson, route, send, rateLimit } from './_lib/http.js';
import { loadIssue } from './_lib/github.js';

export default route(['POST'], async (req, res) => {
  rateLimit(req, 'issue', 30, 60 * 60 * 1000);
  const { url } = await readJson(req);
  send(res, 200, await loadIssue(url));
});
