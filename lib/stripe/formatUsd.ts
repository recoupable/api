/**
 * Formats a Stripe cents amount as a dollar string, e.g. 9900 → "$99.00".
 */
export const formatUsd = (cents: number): string => {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
};
