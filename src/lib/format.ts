/**
 * Formatting helpers.
 *
 * One rule here: every number that a person reads is formatted in exactly one
 * place. The moment two screens format the same value differently, users stop
 * trusting both of them.
 */

const AMOUNT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const FEE = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 6,
  maximumFractionDigits: 6,
});

const FIAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatAmount(value: number): string {
  return AMOUNT.format(value);
}

export function formatFee(value: number): string {
  return FEE.format(value);
}

export function formatFiat(value: number): string {
  return FIAT.format(value);
}

/** Truncate an address for display: first 6 and last 4, never the middle. */
export function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Elapsed time, phrased the way a person waiting would say it.
 * Deliberately vague past a minute, because false precision on a wait that is
 * outside our control reads as a promise we cannot keep.
 */
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes === 1 ? 'about a minute' : `about ${minutes} minutes`;
}
