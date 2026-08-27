import { creditsToUsd } from "@/lib/credits/creditsToUsd";

/**
 * Formats a credit amount as a USD string.
 *
 * Named for cents because that is what a credit is worth today; the
 * conversion goes through `creditsToUsd` so the name is the only thing that
 * has to change when the unit does (recoupable/chat#2000).
 *
 * @param cents - Credit amount (e.g. 412).
 * @returns USD string (e.g. "$4.12").
 */
export function formatCentsAsUsd(cents: number): string {
  return `$${creditsToUsd(cents).toFixed(2)}`;
}
