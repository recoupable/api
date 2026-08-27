/**
 * Fixed per-call prices, in US dollars.
 *
 * The one place a flat price is written down. Handlers convert at the call
 * site with `usdToCredits`, so the ledger unit (recoupable/app#2000) never
 * leaks into a handler as a bare number. Per-use pricing (chat tokens, music
 * seconds) is computed from the provider's rate instead and is not listed.
 */
export const PRICES_USD = {
  chatMinimum: 0.01,
  research: 0.05,
  researchPeople: 0.05,
  researchWeb: 0.01,
  researchEvents: 0.01,
  researchExtractPerUrl: 0.05,
  researchDeep: 0.25,
  researchEnrich: { base: 0.05, core: 0.1, ultra: 0.25 },
  socialScrapeBase: 0.05,
  socialScrapePerPost: 0.01,
} as const;
