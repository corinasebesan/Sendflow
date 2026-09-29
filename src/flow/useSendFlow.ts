import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ACCOUNT,
  awaitConfirmation,
  checkAddress,
  ConfirmationFailed,
  estimateFee,
  submit,
  SubmitRejected,
  type AddressCheck,
} from '../lib/api';
import { initialState, isLocked, reducer, type FlowState } from './machine';

export type AddressStatus =
  | { state: 'empty' }
  | { state: 'checking' }
  | { state: 'valid'; label?: string }
  | { state: 'invalid'; reason: string };

export interface SendFlow {
  state: FlowState;
  fee: number;
  /** The amount actually being sent, derived from intent and the current fee. */
  amount: number;
  /** What the input should display. Differs from `amount` only in max mode. */
  amountText: string;
  isMax: boolean;
  maxSendable: number;
  address: AddressStatus;
  problem: string | null;
  canReview: boolean;
  elapsed: number;
  setAmount: (raw: string) => void;
  useMax: () => void;
  setRecipient: (value: string) => void;
  toReview: () => void;
  back: () => void;
  confirmSend: () => void;
  startOver: () => void;
  retry: () => void;
}

const DEBOUNCE_MS = 350;
const FEE_REFRESH_MS = 3000;

export function useSendFlow(): SendFlow {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [fee, setFee] = useState(() => estimateFee());
  const [address, setAddress] = useState<AddressStatus>({ state: 'empty' });
  const [elapsed, setElapsed] = useState(0);

  const locked = isLocked(state.step);

  /* ------------------------------------------------------------ the fee
   *
   * Refreshed on a timer while the user is still deciding, and frozen once
   * they commit. Letting it move under a signing screen would mean the number
   * they agreed to and the number that gets sent are different, which is the
   * kind of bug that costs someone real money.
   */
  useEffect(() => {
    if (locked) return;
    const id = setInterval(() => setFee(estimateFee()), FEE_REFRESH_MS);
    return () => clearInterval(id);
  }, [locked]);

  const maxSendable = useMemo(
    () => Math.max(0, Number((ACCOUNT.balance - fee).toFixed(6))),
    [fee],
  );

  /* --------------------------------------------------------- the amount
   *
   * Derived, not stored. When the mode is "max" the number recomputes as the
   * fee moves, so it cannot go stale. Anything that derives from state has to
   * be recomputed on every path that changes that state, and a fee that
   * refreshes on a timer is a path people forget.
   */
  const amount = useMemo(() => {
    if (state.draft.amount.mode === 'max') return maxSendable;
    const parsed = Number.parseFloat(state.draft.amount.raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [state.draft.amount, maxSendable]);

  const amountText =
    state.draft.amount.mode === 'max' ? maxSendable.toFixed(6) : state.draft.amount.raw;

  /* ------------------------------------------------- the address check
   *
   * Debounced, because it is a network call on every keystroke otherwise.
   *
   * The guard on `current` is the part that matters. Responses can arrive out
   * of order, so a slow answer to what you typed three keystrokes ago can
   * overwrite the fast answer to what you typed last. Comparing against the
   * value we asked about is what stops a stale response winning.
   */
  const requested = useRef('');

  useEffect(() => {
    const value = state.draft.recipient.trim();
    requested.current = value;

    if (value === '') {
      setAddress({ state: 'empty' });
      return;
    }

    setAddress({ state: 'checking' });

    const id = setTimeout(() => {
      const asked = value;
      checkAddress(asked).then((result: AddressCheck) => {
        if (requested.current !== asked) return; // a newer value is in flight
        setAddress(
          result.status === 'valid'
            ? { state: 'valid', label: result.label }
            : { state: 'invalid', reason: result.reason },
        );
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(id);
  }, [state.draft.recipient]);

  /* ------------------------------------------------------- the problem
   *
   * One message at a time, in the order the user would hit them. Showing
   * three complaints at once is how a form starts feeling hostile.
   */
  const problem = useMemo<string | null>(() => {
    if (amountText === '' && state.draft.amount.mode === 'exact') return null;
    if (amount <= 0) return 'Enter an amount greater than zero.';
    if (amount > maxSendable) {
      return `That is more than you can send. The most is ${maxSendable.toFixed(6)} ${ACCOUNT.symbol} once the network fee is covered.`;
    }
    if (address.state === 'invalid') return address.reason;
    return null;
  }, [amount, amountText, maxSendable, address, state.draft.amount.mode]);

  const canReview =
    !locked &&
    amount > 0 &&
    amount <= maxSendable &&
    address.state === 'valid';

  /* ------------------------------------------------------ elapsed timer */
  useEffect(() => {
    if (state.step.name !== 'pending') {
      setElapsed(0);
      return;
    }
    const submittedAt = state.step.submittedAt;
    const id = setInterval(() => setElapsed(Date.now() - submittedAt), 250);
    return () => clearInterval(id);
  }, [state.step]);

  /* ------------------------------------------------------------ actions */

  const run = useCallback(async () => {
    let txId: string | undefined;
    try {
      const result = await submit();
      txId = result.txId;
      dispatch({ type: 'submitted', txId });
      await awaitConfirmation();
      dispatch({ type: 'confirmed' });
    } catch (error) {
      if (error instanceof SubmitRejected) {
        dispatch({ type: 'failed', kind: 'rejected', message: error.message });
      } else if (error instanceof ConfirmationFailed) {
        dispatch({ type: 'failed', kind: 'not-confirmed', message: error.message, txId });
      } else {
        dispatch({
          type: 'failed',
          kind: 'rejected',
          message: 'Something went wrong before the transaction was sent.',
        });
      }
    }
  }, []);

  const confirmSend = useCallback(() => {
    dispatch({ type: 'sign' });
    void run();
  }, [run]);

  return {
    state,
    fee,
    amount,
    amountText,
    isMax: state.draft.amount.mode === 'max',
    maxSendable,
    address,
    problem,
    canReview,
    elapsed,
    setAmount: (raw) => dispatch({ type: 'amount-typed', raw }),
    useMax: () => dispatch({ type: 'amount-max' }),
    setRecipient: (value) => dispatch({ type: 'recipient-typed', value }),
    toReview: () => dispatch({ type: 'review' }),
    back: () => dispatch({ type: 'back-to-compose' }),
    confirmSend,
    startOver: () => dispatch({ type: 'start-over' }),
    retry: () => dispatch({ type: 'back-to-compose' }),
  };
}

export { ACCOUNT };
