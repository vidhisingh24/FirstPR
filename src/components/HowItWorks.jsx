const STEPS = [
  { title: 'Reads the issue', text: 'The issue, comments, labels, README and CONTRIBUTING guide, straight from GitHub.', tag: 'GitHub API' },
  { title: 'Finds the files', text: 'Looks through the repository’s file list and picks the few files that matter.', tag: 'Nemotron 3 Super' },
  { title: 'Checks the docs', text: 'Searches the web for official docs related to the change.', tag: 'Tavily' },
  { title: 'Writes your plan', text: 'Reasons over everything and writes the steps, a draft fix and your PR text.', tag: 'Nemotron 3 Ultra' },
];

const GETS = ['What the issue means, in plain words', 'How hard it is and how long it may take', 'Which files to open and why', 'A step-by-step plan and a draft diff', 'How to test the change', 'A ready pull request description', 'A polite comment to claim the issue'];

const HowItWorks = () => (
  <section className="how" aria-labelledby="how-title">
    <h2 id="how-title" className="how__title">
      How it works
    </h2>
    <ol className="how__grid">
      {STEPS.map((s, i) => (
        <li key={s.title} className="how__card">
          <span className="how__num">{String(i + 1).padStart(2, '0')}</span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
          <span className="how__tag">{s.tag}</span>
        </li>
      ))}
    </ol>
    <div className="gets">
      <h3>What you get</h3>
      <ul>
        {GETS.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
    </div>
  </section>
);

export default HowItWorks;
