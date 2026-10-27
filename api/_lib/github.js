/** Reads public GitHub data: the issue, its comments, the repo file tree and selected files. */
import { HttpError } from './http.js';

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const RAW = process.env.GITHUB_RAW_URL || 'https://raw.githubusercontent.com';

const MAX_TREE = 1500; // paths sent to the model
const MAX_FILE_CHARS = 14000; // per file
const MAX_TOTAL_CHARS = 60000; // all files together

// Folders and file types that never help a newcomer (build output, binaries, lockfiles…)
const SKIP =
  /(^|\/)(node_modules|vendor|dist|build|out|coverage|\.git|\.next|\.nuxt|\.cache|__pycache__|\.venv|venv|target|bin|obj|\.idea|\.vscode)(\/|$)|\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|mp4|webm|mov|mp3|wav|ogg|pdf|zip|gz|tgz|tar|rar|7z|woff2?|ttf|eot|otf|min\.js|min\.css|map|jar|class|so|dylib|dll|exe|bin|pyc|lock)$|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock)$/i;

const headers = () => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'FirstPR',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

export function parseIssueUrl(url) {
  const m = String(url || '')
    .trim()
    .match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\/?(?:[?#].*)?$/i);
  if (!m) throw new HttpError(400, 'Paste a GitHub issue link, like https://github.com/owner/repo/issues/123');
  return { owner: m[1], repo: m[2].replace(/\.git$/i, ''), number: Number(m[3]) };
}

async function gh(path) {
  const r = await fetch(API + path, { headers: headers() });
  if (r.status === 404) throw new HttpError(404, 'Couldn’t find that on GitHub. Is the repository public and the link correct?');
  if (r.status === 403 || r.status === 429) throw new HttpError(429, 'GitHub’s rate limit was hit. Please try again in a few minutes.');
  if (!r.ok) throw new HttpError(502, `GitHub returned an error (${r.status}).`);
  return r.json();
}

async function raw(owner, repo, ref, path, limit) {
  const url = `${RAW}/${owner}/${repo}/${encodeURIComponent(ref)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'FirstPR' } });
  if (!r.ok) return null;
  const text = await r.text();
  if (text.includes('\u0000')) return null; // binary
  return { text: text.slice(0, limit), truncated: text.length > limit, lines: text.split('\n').length };
}

const clip = (s, n) => {
  const t = String(s || '').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/** Words from the issue, used to keep the most relevant paths when a repo is huge. */
function keywords(text) {
  const stop = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'when', 'from', 'should', 'would', 'could', 'issue', 'there', 'have', 'into', 'not', 'are', 'but', 'can', 'add', 'fix', 'bug', 'feature', 'please', 'also']);
  return [...new Set(String(text).toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) || [])].filter((w) => !stop.has(w)).slice(0, 60);
}

function pickPaths(paths, issueText) {
  if (paths.length <= MAX_TREE) return paths;
  const words = keywords(issueText);
  const scored = paths.map((p) => {
    const lower = p.toLowerCase();
    const depth = p.split('/').length;
    let score = depth <= 2 ? 3 : 0;
    for (const w of words) if (lower.includes(w)) score += 5;
    if (/(^|\/)(src|lib|app|packages|components|pages|api)\//i.test(p)) score += 1;
    if (/test|spec/i.test(p)) score -= 1;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || a.p.length - b.p.length);
  return scored.slice(0, MAX_TREE).map((s) => s.p).sort();
}

/** Everything about the issue a newcomer (and the model) needs to get started. */
export async function loadIssue(url) {
  const { owner, repo, number } = parseIssueUrl(url);
  const base = `/repos/${owner}/${repo}`;
  const [issue, repoInfo, comments] = await Promise.all([
    gh(`${base}/issues/${number}`),
    gh(base),
    gh(`${base}/issues/${number}/comments?per_page=12`).catch(() => []),
  ]);
  if (issue.pull_request) throw new HttpError(400, 'That link is a pull request. Paste an issue link instead.');

  const branch = repoInfo.default_branch;
  const tree = await gh(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const allPaths = (tree.tree || []).filter((t) => t.type === 'blob' && (t.size ?? 0) < 400_000 && !SKIP.test(t.path)).map((t) => t.path);
  const issueText = `${issue.title}\n${issue.body || ''}`;

  // Repo guides: README and CONTRIBUTING (fetched from raw, which doesn't count against the API limit)
  const findDoc = (re) => allPaths.filter((p) => re.test(p)).sort((a, b) => a.split('/').length - b.split('/').length)[0];
  const readmePath = findDoc(/^readme(\.md|\.rst|\.txt)?$/i);
  const contributingPath = findDoc(/(^|\/)contributing(\.md|\.rst|\.txt)?$/i);
  const [readme, contributing] = await Promise.all([
    readmePath ? raw(owner, repo, branch, readmePath, 4000) : null,
    contributingPath ? raw(owner, repo, branch, contributingPath, 6000) : null,
  ]);

  return {
    issue: {
      url: issue.html_url,
      number: issue.number,
      title: issue.title,
      body: clip(issue.body, 8000),
      state: issue.state,
      labels: (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean),
      assignees: (issue.assignees || []).map((a) => a.login),
      author: issue.user?.login,
      createdAt: issue.created_at,
      comments: (Array.isArray(comments) ? comments : []).map((c) => ({ author: c.user?.login, body: clip(c.body, 1200) })),
    },
    repo: {
      owner,
      name: repo,
      fullName: repoInfo.full_name,
      url: repoInfo.html_url,
      description: repoInfo.description,
      language: repoInfo.language,
      stars: repoInfo.stargazers_count,
      defaultBranch: branch,
    },
    tree: pickPaths(allPaths, issueText),
    totalFiles: allPaths.length,
    guides: {
      readme: readme ? { path: readmePath, text: readme.text } : null,
      contributing: contributing ? { path: contributingPath, text: contributing.text } : null,
    },
  };
}

/** Downloads the chosen files (trimmed so the prompt stays a sensible size). */
export async function loadFiles(repo, picks) {
  let budget = MAX_TOTAL_CHARS;
  const out = [];
  for (const pick of picks) {
    if (budget <= 0) break;
    const file = await raw(repo.owner, repo.name, repo.defaultBranch, pick.path, Math.min(MAX_FILE_CHARS, budget));
    if (!file) continue;
    budget -= file.text.length;
    out.push({
      path: pick.path,
      reason: pick.reason,
      url: `${repo.url}/blob/${repo.defaultBranch}/${pick.path}`,
      content: file.text,
      truncated: file.truncated,
      lines: file.lines,
    });
  }
  return out;
}
