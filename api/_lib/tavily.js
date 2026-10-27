/** Tavily web search: finds official docs and guides related to the issue. */
const URL = process.env.TAVILY_API_URL || 'https://api.tavily.com/search';

export async function searchDocs(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query) return { results: [], skipped: true };
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: String(query).slice(0, 380), search_depth: 'basic', max_results: 5, include_answer: false }),
  });
  if (!r.ok) return { results: [], error: `Tavily returned ${r.status}` };
  const json = await r.json();
  return {
    results: (json.results || []).slice(0, 5).map((x) => ({
      title: x.title,
      url: x.url,
      snippet: String(x.content || '').slice(0, 700),
    })),
  };
}
