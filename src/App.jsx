import { useRef, useState } from 'react';
import IssueForm from './components/IssueForm';
import Steps from './components/Steps';
import ContextPanel from './components/ContextPanel';
import PlanView from './components/PlanView';
import HowItWorks from './components/HowItWorks';
import { GitHub, Logo } from './components/Icons';
import { postJson, postStream } from './lib/api';

const REPO_URL = 'https://github.com/vidhisingh24/FirstPR';

const freshSteps = () => [
  { id: 'issue', label: 'Reading the issue', engine: 'GitHub', state: 'pending' },
  { id: 'locate', label: 'Finding the files that matter', engine: 'Nemotron 3 Super', state: 'pending' },
  { id: 'docs', label: 'Checking the docs', engine: 'Tavily', state: 'pending' },
  { id: 'plan', label: 'Writing your plan', engine: 'Nemotron 3 Ultra', state: 'pending' },
];

const modelName = (id = '') => {
  const tail = id.split('/').pop() || id;
  if (/ultra/i.test(tail)) return 'NVIDIA Nemotron 3 Ultra';
  if (/super/i.test(tail)) return 'NVIDIA Nemotron 3 Super';
  return tail;
};

function App() {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [steps, setSteps] = useState(freshSteps);
  const [context, setContext] = useState({});
  const [plan, setPlan] = useState('');
  const [thinking, setThinking] = useState(false);
  const [planModel, setPlanModel] = useState('NVIDIA Nemotron 3 Ultra');
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const resultsRef = useRef(null);

  const step = (id, patch) => setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const run = async (url, level) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { signal } = ctrl;

    setStatus('running');
    setSteps(freshSteps());
    setContext({});
    setPlan('');
    setError('');
    setThinking(false);
    let current = 'issue';
    window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

    try {
      // 1. Issue + repo
      step('issue', { state: 'active' });
      const data = await postJson('/api/issue', { url }, signal);
      setContext({ issue: data.issue, repo: data.repo });
      step('issue', { state: 'done', detail: `${data.repo.fullName} · ${data.totalFiles.toLocaleString()} files` });

      // 2. Files (fast model)
      current = 'locate';
      step('locate', { state: 'active' });
      const located = await postJson('/api/locate', { issue: data.issue, repo: data.repo, tree: data.tree, totalFiles: data.totalFiles }, signal);
      setContext((c) => ({ ...c, files: located.files }));
      step('locate', { state: 'done', detail: `${located.files.length} ${located.files.length === 1 ? 'file' : 'files'} in ${(located.ms / 1000).toFixed(1)}s` });

      // 3. Docs (Tavily)
      current = 'docs';
      step('docs', { state: 'active', detail: located.searchQuery ? `“${located.searchQuery}”` : '' });
      const docs = await postJson('/api/docs', { query: located.searchQuery }, signal).catch(() => ({ results: [] }));
      setContext((c) => ({ ...c, docs: docs.results }));
      step('docs', { state: 'done', detail: docs.skipped ? 'Skipped (no Tavily key)' : `${docs.results.length} ${docs.results.length === 1 ? 'page' : 'pages'} found` });

      // 4. Plan (reasoning model, streamed)
      current = 'plan';
      step('plan', { state: 'active' });
      const started = Date.now();
      let text = '';
      let frame = 0;
      await postStream(
        '/api/plan',
        { issue: data.issue, repo: data.repo, tree: data.tree, guides: data.guides, files: located.files, docs: docs.results, level },
        (ev) => {
          if (ev.type === 'start') setPlanModel(modelName(ev.model));
          if (ev.type === 'thinking') setThinking(true);
          if (ev.type === 'token') {
            text += ev.text;
            if (!frame) {
              frame = window.requestAnimationFrame(() => {
                frame = 0;
                setPlan(text);
              });
            }
          }
        },
        signal,
      );
      window.cancelAnimationFrame(frame);
      setPlan(text);
      if (!text.trim()) throw new Error('The model returned an empty answer. Please try again.');
      step('plan', { state: 'done', detail: `Done in ${((Date.now() - started) / 1000).toFixed(0)}s` });
      setStatus('done');
    } catch (err) {
      if (signal.aborted) {
        setStatus('idle');
        step(current, { state: 'pending', detail: 'Stopped' });
        return;
      }
      step(current, { state: 'error', detail: err.message });
      setError(err.message || 'Something went wrong.');
      setStatus('error');
    } finally {
      setThinking(false);
    }
  };

  const busy = status === 'running';
  const started = status !== 'idle' || plan;

  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className="top">
        <a href="/" className="brand" aria-label="FirstPR home">
          <Logo /> FirstPR
        </a>
        <p className="top__badge">
          NVIDIA Nemotron <span aria-hidden="true">×</span> Nebius Token Factory
        </p>
        <a className="top__gh" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <GitHub /> <span>Source</span>
        </a>
      </header>

      <main id="main">
        <section className="hero">
          <p className="hero__eyebrow">For first-time open-source contributors</p>
          <h1 className="hero__title">
            Your first pull request, <em>mapped out.</em>
          </h1>
          <p className="hero__lead">Paste a GitHub issue. FirstPR reads the repository, finds the files that matter and writes a step-by-step plan, a draft fix and your pull request description.</p>
          <IssueForm busy={busy} onSubmit={run} onCancel={() => abortRef.current?.abort()} />
        </section>

        {started ? (
          <div className="results" ref={resultsRef}>
            <div className="results__side">
              <Steps steps={steps} />
              <ContextPanel context={context} />
            </div>
            <div className="results__main">
              {error && (
                <div className="error" role="alert">
                  <p className="error__title">Couldn’t finish the plan</p>
                  <p>{error}</p>
                </div>
              )}
              {(plan || steps[3].state === 'active') && <PlanView text={plan} streaming={busy} thinking={thinking} model={planModel} />}
              {!plan && !error && steps[3].state !== 'active' && (
                <div className="waiting" aria-live="polite">
                  <p>Reading the repository so the plan is about real files, not guesses…</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <HowItWorks />
        )}
      </main>

      <footer className="foot">
        <p>
          Built by{' '}
          <a href="https://github.com/vidhisingh24" target="_blank" rel="noopener noreferrer">
            Vidhi Singh
          </a>{' '}
          for the Nebius × NVIDIA Global AI Hackathon. Plans are AI-generated drafts, so always check them against the code.
        </p>
      </footer>
    </>
  );
}

export default App;
