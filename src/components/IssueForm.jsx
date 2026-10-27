import { useState } from 'react';
import { Arrow } from './Icons';

const LEVELS = [
  { id: 'new', label: 'First PR ever' },
  { id: 'some', label: 'Made a few' },
  { id: 'pro', label: 'Comfortable' },
];

const ISSUE_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+\/?(?:[?#].*)?$/i;

/** Issue link + experience level. */
const IssueForm = ({ busy, onSubmit, onCancel }) => {
  const [url, setUrl] = useState('');
  const [level, setLevel] = useState('new');
  const [touched, setTouched] = useState(false);
  const valid = ISSUE_RE.test(url.trim());

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (valid && !busy) onSubmit(url.trim(), level);
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="form__label" htmlFor="issue-url">
        GitHub issue link
      </label>
      <div className="form__row">
        <input
          id="issue-url"
          className="form__input"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck="false"
          placeholder="https://github.com/owner/repo/issues/123"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && !valid ? 'true' : undefined}
          aria-describedby="issue-help"
          disabled={busy}
        />
        {busy ? (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn btn--lav">
            Map my PR <Arrow />
          </button>
        )}
      </div>
      <p id="issue-help" className={`form__help${touched && url && !valid ? ' form__help--err' : ''}`}>
        {touched && url && !valid ? 'That doesn’t look like a GitHub issue link. It should end in /issues/ and a number.' : 'Any public repository works. Good first issues are a great place to start.'}
      </p>

      <fieldset className="levels" disabled={busy}>
        <legend className="form__label">Your experience</legend>
        <div className="levels__row">
          {LEVELS.map((l) => (
            <label key={l.id} className={`level${level === l.id ? ' level--on' : ''}`}>
              <input type="radio" name="level" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
};

export default IssueForm;
