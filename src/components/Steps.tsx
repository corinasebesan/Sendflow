import { motion } from 'motion/react';
import { ACCOUNT } from '../lib/api';
import { formatAmount, formatElapsed, formatFee, formatFiat, truncateAddress } from '../lib/format';
import type { SendFlow } from '../flow/useSendFlow';

/* ------------------------------------------------------------- primitives */

function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}

function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/* ---------------------------------------------------------------- compose */

export function Compose({ flow }: { flow: SendFlow }) {
  const { address, problem } = flow;

  return (
    <div className="card-body">
      <div className="field">
        <label htmlFor="amount">Amount</label>
        <div className="input-wrap" data-invalid={problem != null && flow.amount > flow.maxSendable}>
          <input
            id="amount"
            className="amount-input"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={flow.amountText}
            onChange={(e) => flow.setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            aria-describedby="amount-hint"
          />
          <span className="symbol">{ACCOUNT.symbol}</span>
          <button
            type="button"
            className="pill"
            data-on={flow.isMax}
            onClick={flow.useMax}
            aria-pressed={flow.isMax}
          >
            Max
          </button>
        </div>
        <div className="hint" id="amount-hint">
          <span>{formatFiat(flow.amount * ACCOUNT.fiatRate)}</span>
          {/* Keyed on the value, so it pulses each time the fee moves and the
              available amount is recalculated. The change is real either way;
              this just makes it visible instead of silent. */}
          <motion.span
            key={flow.maxSendable}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          >
            {formatAmount(flow.maxSendable)} {ACCOUNT.symbol} available
          </motion.span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="to">To</label>
        <div className="input-wrap" data-invalid={address.state === 'invalid'}>
          <input
            id="to"
            className="mono"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={flow.state.draft.recipient}
            onChange={(e) => flow.setRecipient(e.target.value)}
            aria-describedby="to-hint"
          />
          {address.state === 'checking' && <Spinner />}
        </div>
        <div className="hint" id="to-hint" aria-live="polite">
          {address.state === 'checking' && <span>Checking…</span>}
          {address.state === 'valid' && (
            <span className="ok">{address.label ?? 'Address looks valid'}</span>
          )}
          {address.state === 'invalid' && <span className="warn">{address.reason}</span>}
          {address.state === 'empty' && <span>Paste the address you are sending to</span>}
        </div>
      </div>

      {problem && address.state !== 'invalid' && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="hint"
          role="alert"
          style={{ marginTop: 16 }}
        >
          <span className="warn">{problem}</span>
        </motion.p>
      )}

      <div className="actions">
        <button className="btn" disabled={!flow.canReview} onClick={flow.toReview}>
          Review
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- review */

export function Review({ flow }: { flow: SendFlow }) {
  const total = flow.amount + flow.fee;

  return (
    <div className="card-body">
      <dl className="rows">
        <div className="row">
          <dt>Sending</dt>
          <dd>
            {formatAmount(flow.amount)} {ACCOUNT.symbol}
            <span className="sub">{formatFiat(flow.amount * ACCOUNT.fiatRate)}</span>
          </dd>
        </div>
        <div className="row">
          <dt>To</dt>
          <dd className="addr">{truncateAddress(flow.state.draft.recipient)}</dd>
        </div>
        <div className="row">
          <dt>Network fee</dt>
          <dd>
            {formatFee(flow.fee)} {ACCOUNT.symbol}
            <span className="sub">{formatFiat(flow.fee * ACCOUNT.fiatRate)}</span>
          </dd>
        </div>
        <div className="row total">
          <dt>Total</dt>
          <dd>
            {formatAmount(total)} {ACCOUNT.symbol}
            <span className="sub">{formatFiat(total * ACCOUNT.fiatRate)}</span>
          </dd>
        </div>
      </dl>

      <p className="note">
        The fee is frozen at the number above from this point on. It was still moving while you were
        choosing the amount.
      </p>

      <div className="actions">
        <button className="btn" onClick={flow.confirmSend}>
          Confirm and send
        </button>
        <button className="btn ghost" onClick={flow.back}>
          Back
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- signing */

export function Signing() {
  return (
    <div className="card-body status">
      <div className="dial">
        <svg viewBox="0 0 100 100">
          <circle className="track" cx="50" cy="50" r="42" />
          <motion.circle
            className="head"
            cx="50"
            cy="50"
            r="42"
            strokeDasharray="264"
            initial={{ strokeDashoffset: 264 }}
            animate={{ strokeDashoffset: [264, 66, 264] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ rotate: -90, transformOrigin: '50% 50%' }}
          />
        </svg>
      </div>
      <h2>Signing</h2>
      <p>Confirming the transaction. Nothing has been sent yet.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- pending */

export function Pending({ flow }: { flow: SendFlow }) {
  if (flow.state.step.name !== 'pending') return null;
  const { txId } = flow.state.step;

  return (
    <div className="card-body status">
      <div className="dial">
        <svg viewBox="0 0 100 100">
          <circle className="track" cx="50" cy="50" r="42" />
          <motion.circle
            className="head"
            cx="50"
            cy="50"
            r="42"
            strokeDasharray="70 264"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '50% 50%' }}
          />
        </svg>
      </div>
      <h2>
        On its way <Dots />
      </h2>
      <p>
        Sent {formatElapsed(flow.elapsed)} ago. Confirmation time is set by the network, not by this
        app, so this can take a while.
      </p>
      <div className="txid">
        <span>Transaction</span>
        {txId}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- confirmed */

export function Confirmed({ flow }: { flow: SendFlow }) {
  if (flow.state.step.name !== 'confirmed') return null;

  return (
    <div className="card-body status">
      <motion.div
        className="mark good"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      >
        <svg viewBox="0 0 24 24">
          <motion.path
            d="M4 12.5l5 5L20 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.38, delay: 0.12, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>
      <h2>Sent</h2>
      <p>
        {formatAmount(flow.amount)} {ACCOUNT.symbol} reached{' '}
        {truncateAddress(flow.state.draft.recipient)}.
      </p>
      <div className="txid">
        <span>Transaction</span>
        {flow.state.step.txId}
      </div>
      <div className="actions">
        <button className="btn" onClick={flow.startOver}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- failed */

export function Failed({ flow }: { flow: SendFlow }) {
  if (flow.state.step.name !== 'failed') return null;
  const step = flow.state.step;
  const nothingSent = step.kind === 'rejected';

  return (
    <div className="card-body status">
      <motion.div
        className="mark bad"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      >
        <svg viewBox="0 0 24 24">
          <motion.path
            d="M6 6l12 12M18 6L6 18"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          />
        </svg>
      </motion.div>
      <h2>{nothingSent ? 'Not sent' : 'Did not confirm'}</h2>
      <p>{step.message}</p>

      {step.txId && (
        <div className="txid">
          <span>Transaction</span>
          {step.txId}
        </div>
      )}

      <p className="note">
        {nothingSent
          ? 'Your amount and address are still filled in, so trying again is one tap.'
          : 'Check the transaction before sending again, so you do not pay twice for the same transfer.'}
      </p>

      <div className="actions">
        <button className="btn" onClick={flow.retry}>
          {nothingSent ? 'Try again' : 'Back to the form'}
        </button>
        <button className="btn ghost" onClick={flow.startOver}>
          Start over
        </button>
      </div>
    </div>
  );
}
