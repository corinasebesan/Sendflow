import { AnimatePresence, motion } from 'motion/react';
import { useSendFlow } from './flow/useSendFlow';
import { ACCOUNT, getFailureMode, setFailureMode, type FailureMode } from './lib/api';
import { formatAmount, formatFiat } from './lib/format';
import { Compose, Confirmed, Failed, Pending, Review, Signing } from './components/Steps';
import { useState } from 'react';

/**
 * One step is on screen at a time and the card grows to fit it. The height
 * animates rather than jumping, because a panel that snaps between sizes reads
 * as two different screens rather than one thing changing.
 */
const variants = {
  enter: (forward: boolean) => ({ opacity: 0, x: forward ? 28 : -28 }),
  centre: { opacity: 1, x: 0 },
  exit: (forward: boolean) => ({ opacity: 0, x: forward ? -28 : 28, position: 'absolute' as const }),
};

const ORDER = ['compose', 'review', 'signing', 'pending', 'confirmed', 'failed'];

export default function App() {
  const flow = useSendFlow();
  const [mode, setMode] = useState<FailureMode>(getFailureMode());
  const [previous, setPrevious] = useState(0);

  const index = ORDER.indexOf(flow.state.step.name);
  const forward = index >= previous;
  if (index !== previous) setPrevious(index);

  const step = flow.state.step;

  function pick(next: FailureMode) {
    setFailureMode(next);
    setMode(next);
  }

  return (
    <div className="app">
      <div className="stage">
        <div className="card">
          <header className="head">
            <h1>Send</h1>
            <div className="balance">
              Balance
              <b>
                {formatAmount(ACCOUNT.balance)} {ACCOUNT.symbol}
              </b>
              {formatFiat(ACCOUNT.balance * ACCOUNT.fiatRate)}
            </div>
          </header>

          <motion.div layout style={{ position: 'relative', overflow: 'hidden' }}>
            <AnimatePresence mode="popLayout" custom={forward} initial={false}>
              <motion.div
                key={step.name}
                custom={forward}
                variants={variants}
                initial="enter"
                animate="centre"
                exit="exit"
                transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
                style={{ width: '100%' }}
              >
                {step.name === 'compose' && <Compose flow={flow} />}
                {step.name === 'review' && <Review flow={flow} />}
                {step.name === 'signing' && <Signing />}
                {step.name === 'pending' && <Pending flow={flow} />}
                {step.name === 'confirmed' && <Confirmed flow={flow} />}
                {step.name === 'failed' && <Failed flow={flow} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        <div className="tray">
          <span>Simulate:</span>
          {(
            [
              ['none', 'Happy path'],
              ['reject', 'Rejected before sending'],
              ['fail-after-submit', 'Fails after sending'],
              ['slow', 'Slow network'],
            ] as [FailureMode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="pill"
              data-on={mode === value}
              onClick={() => pick(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
