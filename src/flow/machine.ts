/**
 * The send flow, modelled as an explicit state machine.
 *
 * The alternative is a handful of booleans: isReviewing, isSubmitting,
 * isPending, hasFailed. Those multiply. Four booleans describe sixteen
 * combinations and only six of them are real, so every component ends up
 * defensively checking combinations that cannot happen, and eventually one
 * that can happen gets missed.
 *
 * A discriminated union makes the illegal states unrepresentable instead. You
 * cannot be pending and failed at the same time, because there is one `step`.
 */

export type FailureKind =
  /** Rejected before anything was sent. Nothing left the wallet. */
  | 'rejected'
  /** Submitted, then did not confirm. The fee was still spent. */
  | 'not-confirmed';

export type Step =
  | { name: 'compose' }
  | { name: 'review' }
  | { name: 'signing' }
  | { name: 'pending'; txId: string; submittedAt: number }
  | { name: 'confirmed'; txId: string }
  | { name: 'failed'; kind: FailureKind; message: string; txId?: string };

/**
 * How the amount was arrived at.
 *
 * This is the distinction the whole fee problem turns on. "Max" is not a
 * number the user typed, it is a rule: everything I have, minus whatever the
 * network charges. The fee moves on its own, so if we store the number the
 * rule produced, it silently goes stale and the transaction fails on
 * submission for a reason the user cannot see.
 *
 * So we store the intent and derive the number.
 */
export type AmountIntent =
  | { mode: 'exact'; raw: string }
  | { mode: 'max' };

export interface Draft {
  amount: AmountIntent;
  recipient: string;
}

export interface FlowState {
  step: Step;
  /**
   * The draft lives outside the step on purpose. Going back from review to
   * compose must not lose what was typed, and a failed transaction should
   * leave the user one click from trying again rather than starting over.
   */
  draft: Draft;
}

export const initialState: FlowState = {
  step: { name: 'compose' },
  draft: { amount: { mode: 'exact', raw: '' }, recipient: '' },
};

export type Action =
  | { type: 'amount-typed'; raw: string }
  | { type: 'amount-max' }
  | { type: 'recipient-typed'; value: string }
  | { type: 'review' }
  | { type: 'back-to-compose' }
  | { type: 'sign' }
  | { type: 'submitted'; txId: string }
  | { type: 'confirmed' }
  | { type: 'failed'; kind: FailureKind; message: string; txId?: string }
  | { type: 'start-over' };

export function reducer(state: FlowState, action: Action): FlowState {
  switch (action.type) {
    case 'amount-typed':
      return {
        ...state,
        draft: { ...state.draft, amount: { mode: 'exact', raw: action.raw } },
      };

    case 'amount-max':
      return { ...state, draft: { ...state.draft, amount: { mode: 'max' } } };

    case 'recipient-typed':
      return { ...state, draft: { ...state.draft, recipient: action.value } };

    case 'review':
      return state.step.name === 'compose' ? { ...state, step: { name: 'review' } } : state;

    case 'back-to-compose':
      // Reachable from review and from a failure. Deliberately not from
      // pending: once it is on the network, going back is a lie.
      return state.step.name === 'pending' || state.step.name === 'signing'
        ? state
        : { ...state, step: { name: 'compose' } };

    case 'sign':
      return state.step.name === 'review' ? { ...state, step: { name: 'signing' } } : state;

    case 'submitted':
      return {
        ...state,
        step: { name: 'pending', txId: action.txId, submittedAt: Date.now() },
      };

    case 'confirmed':
      return state.step.name === 'pending'
        ? { ...state, step: { name: 'confirmed', txId: state.step.txId } }
        : state;

    case 'failed':
      return {
        ...state,
        step: {
          name: 'failed',
          kind: action.kind,
          message: action.message,
          txId: action.txId,
        },
      };

    case 'start-over':
      return initialState;

    default:
      return state;
  }
}

/** Steps during which the user must not be able to change the draft. */
export function isLocked(step: Step): boolean {
  return step.name === 'signing' || step.name === 'pending';
}
