/**
 * Converts a price string to the number of credits required.
 * 1 credit = $0.01, rounded up to the nearest credit.
 *
 * @param price - The price string (e.g., "$0.01" or "0.01").
 * @returns The number of credits required, rounded up.
 * @throws Error if the price string is invalid or cannot be parsed.
 */
export function getCreditsForPrice(price: string): number {
  const priceNumber = parseFloat(price);
  if (isNaN(priceNumber) || priceNumber <= 0) {
    throw new Error(`Invalid price string: ${price}`);
  }
  const credits = Math.ceil(priceNumber / 0.01);
  return credits;
}
