import { useMemo } from 'react';
import { renderMarkdown, splitSections } from '../lib/markdown';

const difficultyTone = (text) => {
  const t = text.toLowerCase();
  if (t.startsWith('beginner')) return 'easy';
  if (t.startsWith('intermediate')) return 'mid';
  if (t.startsWith('advanced')) return 'hard';
  return '';
};

const copy = async (button) => {
  const code = button.closest('.code')?.querySelector('code')?.innerText ?? '';
  try {
    await navigator.clipboard.writeText(code);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Select and copy';
  }
  window.setTimeout(() => (button.textContent = 'Copy'), 1600);
};

/** The plan, one card per section, rendered as it streams. */
const PlanView = ({ text, streaming, thinking, model }) => {
  const sections = useMemo(() => splitSections(text), [text]);

  const onClick = (e) => {
    const btn = e.target.closest('.copy-btn');
    if (btn) copy(btn);
  };

  return (
    <section className="plan" aria-label="Your plan" aria-busy={streaming} onClick={onClick}>
      <header className="plan__head">
        <h2 className="plan__title">Your plan</h2>
        <p className="plan__model">
          {streaming ? (thinking && !text ? 'Nemotron is thinking…' : 'Writing…') : 'Written by'} <span>{model}</span>
        </p>
      </header>

      {!text && streaming && (
        <div className="plan__skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      {sections.map((s, i) => {
        const tone = s.title === 'Difficulty' ? difficultyTone(s.body.trim()) : '';
        const last = i === sections.length - 1;
        return (
          <article key={`${i}-${s.title}`} className={`section${tone ? ` section--${tone}` : ''}`}>
            {s.title && (
              <h3 className="section__title">
                <span className="section__num">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </h3>
            )}
            <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.body) }} />
            {streaming && last && <span className="caret" aria-hidden="true" />}
          </article>
        );
      })}

      {!streaming && text && <p className="plan__note">This is a draft. Run the code and tests locally before opening your pull request.</p>}
    </section>
  );
};

export default PlanView;
