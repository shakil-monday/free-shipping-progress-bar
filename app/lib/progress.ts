// Pure progress-bar logic shared by the admin preview and tests.
// The storefront script (extensions/free-shipping-bar/assets/fsb.js) mirrors
// computeProgress/fillMessage; keep the two in sync.

export type ProgressState = "empty" | "progress" | "success";

export interface ProgressResult {
  state: ProgressState;
  /** Amount still needed, in minor units of the presentment currency. */
  remainingCents: number;
  /** 0–100 */
  percent: number;
}

/**
 * @param cartCents      cart total in presentment currency minor units
 * @param thresholdCents threshold in shop currency minor units
 * @param rate           presentment/shop currency rate (Shopify.currency.rate)
 */
export function computeProgress(
  cartCents: number,
  thresholdCents: number,
  rate = 1,
): ProgressResult {
  const threshold = Math.round(thresholdCents * (rate > 0 ? rate : 1));
  if (threshold <= 0) return { state: "success", remainingCents: 0, percent: 100 };
  if (cartCents <= 0) return { state: "empty", remainingCents: threshold, percent: 0 };
  if (cartCents >= threshold)
    return { state: "success", remainingCents: 0, percent: 100 };
  return {
    state: "progress",
    remainingCents: threshold - cartCents,
    percent: Math.min(100, Math.max(0, (cartCents / threshold) * 100)),
  };
}

export function formatMoney(cents: number, currency: string, locale = "en") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** Replaces {amount} and {threshold} tokens. */
export function fillMessage(
  template: string,
  values: { amount: string; threshold: string },
) {
  return template
    .replace(/\{amount\}/g, values.amount)
    .replace(/\{threshold\}/g, values.threshold);
}
