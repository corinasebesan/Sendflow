/**
 * A fake network layer.
 *
 * It exists so that every state the real thing can be in is reachable here:
 * slow responses, a fee that moves while you are deciding, an address that
 * turns out to be invalid, a transaction that is rejected before submission,
 * and a transaction that is accepted and then fails afterwards.
 *
 * The failure modes are switchable from the UI rather than random, because a
 * demo you cannot steer is a demo you cannot show.
 */

export type FailureMode = 'none' | 'reject' | 'fail-after-submit' | 'slow';

let failureMode: FailureMode = 'none';

export function setFailureMode(mode: FailureMode) {
  failureMode = mode;
}

export function getFailureMode(): FailureMode {
  return failureMode;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface Account {
  symbol: string;
  balance: number;
  fiatRate: number;
}

export const ACCOUNT: Account = {
  symbol: 'ETH',
  balance: 2.4718,
  fiatRate: 3184.52,
};

/* ------------------------------------------------------------------ fees */

/**
 * The network fee is not a constant and it is not ours to control. It moves
 * while the user is deciding, which is the whole reason the amount field has
 * to be derived rather than stored.
 */
export function estimateFee(): number {
  const base = 0.00041;
  const drift = (Math.random() - 0.5) * 0.00018;
  return Math.max(0.0001, Number((base + drift).toFixed(6)));
}

/* --------------------------------------------------------------- address */

export type AddressCheck =
  | { status: 'valid'; label?: string }
  | { status: 'invalid'; reason: string };

const KNOWN: Record<string, string> = {
  '0x8a2f1c4e9b7d3a6501fe82cd4b19a7e3f5c02d8b': 'Saved: Cold wallet',
  '0x3f91b7c25ad8e40613fc7b2e95d1a806c4f7e9d2': 'Saved: Payroll',
};

export async function checkAddress(address: string): Promise<AddressCheck> {
  await wait(420 + Math.random() * 260);

  const trimmed = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return {
      status: 'invalid',
      reason: 'That is not a valid address. It should start with 0x and have 40 characters after it.',
    };
  }
  return { status: 'valid', label: KNOWN[trimmed.toLowerCase()] };
}

/* ------------------------------------------------------------ submission */

export interface SubmitResult {
  txId: string;
}

export class SubmitRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmitRejected';
  }
}

export class ConfirmationFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfirmationFailed';
  }
}

/** Signing and submitting. Can be rejected. Nothing has left the wallet yet. */
export async function submit(): Promise<SubmitResult> {
  await wait(failureMode === 'slow' ? 2600 : 1100);

  if (failureMode === 'reject') {
    throw new SubmitRejected('The transaction was rejected before it was sent. Nothing left your wallet.');
  }

  const txId = `0x${Array.from({ length: 64 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)],
  ).join('')}`;

  return { txId };
}

/**
 * Waiting for confirmation. This is the part that is genuinely out of our
 * hands, so it is the part the interface has to be honest about.
 */
export async function awaitConfirmation(signal?: AbortSignal): Promise<void> {
  const total = failureMode === 'slow' ? 14000 : 7400;
  const step = 200;

  for (let elapsed = 0; elapsed < total; elapsed += step) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    await wait(step);
  }

  if (failureMode === 'fail-after-submit') {
    throw new ConfirmationFailed(
      'The transaction was sent but did not confirm. The network fee was still spent.',
    );
  }
}
