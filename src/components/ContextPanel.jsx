import { Alert, External } from './Icons';

/** What FirstPR read: the issue, the files it picked and the docs it found. */
const ContextPanel = ({ context }) => {
  const { issue, repo, files, docs } = context;
  if (!issue) return null;
  return (
    <aside className="context" aria-label="What FirstPR read">
      <section className="card">
        <p className="eyebrow">Issue</p>
        <a className="issue__title" href={issue.url} target="_blank" rel="noopener noreferrer">
          {issue.title} <span className="muted">#{issue.number}</span>
        </a>
        <p className="issue__repo">
          <a href={repo.url} target="_blank" rel="noopener noreferrer">
            {repo.fullName}
          </a>
          {repo.language && <> · {repo.language}</>}
          {typeof repo.stars === 'number' && <> · ★ {repo.stars.toLocaleString()}</>}
        </p>
        {issue.labels.length > 0 && (
          <ul className="chips">
            {issue.labels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {issue.state === 'closed' && (
          <p className="warn">
            <Alert /> This issue is closed. Check with the maintainers before working on it.
          </p>
        )}
        {issue.assignees.length > 0 && (
          <p className="warn">
            <Alert /> Already assigned to {issue.assignees.map((a) => `@${a}`).join(', ')}. Ask on the issue before starting.
          </p>
        )}
      </section>

      {files?.length > 0 && (
        <section className="card">
          <p className="eyebrow">Files Nemotron picked</p>
          <ul className="files">
            {files.map((f) => (
              <li key={f.path}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="files__path">
                  {f.path} <External />
                </a>
                {f.reason && <p className="files__why">{f.reason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {docs?.length > 0 && (
        <section className="card">
          <p className="eyebrow">Docs found with Tavily</p>
          <ul className="docs">
            {docs.map((d) => (
              <li key={d.url}>
                <a href={d.url} target="_blank" rel="noopener noreferrer">
                  {d.title || d.url} <External />
                </a>
                <span className="docs__host">{safeHost(d.url)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
};

const safeHost = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export default ContextPanel;
