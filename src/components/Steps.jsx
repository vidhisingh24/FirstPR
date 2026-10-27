import { Alert, Check } from './Icons';

/** The agent's steps, live. */
const Steps = ({ steps }) => (
  <ol className="steps" aria-label="Progress">
    {steps.map((s, i) => (
      <li key={s.id} className={`step step--${s.state}`} aria-current={s.state === 'active' ? 'step' : undefined}>
        <span className="step__dot" aria-hidden="true">
          {s.state === 'done' ? <Check /> : s.state === 'error' ? <Alert /> : i + 1}
        </span>
        <div className="step__body">
          <p className="step__label">
            {s.label}
            {s.engine && <span className="step__engine">{s.engine}</span>}
          </p>
          {s.detail && <p className="step__detail">{s.detail}</p>}
        </div>
      </li>
    ))}
  </ol>
);

export default Steps;
