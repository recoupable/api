const PACKAGE_LABELS: Record<string, string> = {
  // /advisory packages
  "strategy-session": "Strategy Session ($2,500)",
  "ai-transformation": "AI Transformation ($10,000)",
  "retained-advisor": "Retained Advisor ($5,000/mo)",
  // /build packages (chat#1800 Phase 2) — published "from" floors
  "care-plan": "Care Plan (from $750/mo)",
  "starter-build": "Starter Build (from $2,500)",
  "custom-build": "Custom Build (from $10k)",
};

/**
 * Maps an advisory package slug to the human label used in the Attio note
 * title and the Telegram ping. Falls back to the raw slug so an unknown
 * package is still triageable rather than blank.
 *
 * @param slug - The package slug the form submitted.
 * @returns The display label.
 */
export function packageLabel(slug: string): string {
  return PACKAGE_LABELS[slug] || slug;
}
