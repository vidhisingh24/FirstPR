/** POST /api/docs {query} → Tavily search for docs that help with the change. */
import { readJson, route, send } from './_lib/http.js';
import { searchDocs } from './_lib/tavily.js';

export default route(['POST'], async (req, res) => {
  const { query } = await readJson(req);
  send(res, 200, await searchDocs(query));
});
