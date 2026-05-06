import { cityNames } from "@/lib/sessions/cityNames";

/**
 * Picks a random city name not already in `usedNames`. When every
 * curated city has been used at least once, falls back to suffixing
 * with the smallest unused integer (e.g. `"Tokyo 2"`, `"Tokyo 3"`).
 *
 * Ported from open-agents so generated titles look familiar to the
 * existing frontend after cutover.
 *
 * @param usedNames - Session titles the account already has.
 * @returns A title not present in `usedNames`.
 */
export function getRandomCityName(usedNames: Set<string>): string {
  const available = cityNames.filter(city => !usedNames.has(city));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)]!;
  }

  const base = cityNames[Math.floor(Math.random() * cityNames.length)]!;
  let suffix = 2;
  while (usedNames.has(`${base} ${suffix}`)) {
    suffix++;
  }
  return `${base} ${suffix}`;
}
