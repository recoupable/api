# Card-removal acceptance

Tracks [Mono #343](https://github.com/recoupable/mono/issues/343). This suite supplies independent, executable acceptance for the owning billing repair. It makes no production changes and does not contact Stripe, Supabase, Privy or Resend.

## Run

```sh
pnpm exec vitest run lib/billing/__tests__/cardRemovalAcceptance.test.ts
```

The suite keeps real API-key HMAC authentication, account parameter validation, removal/card/settings handlers, Stripe selectors, Supabase adapters and the automatic purchase orchestration. Only the external client boundaries use in-memory providers. API keys, account IDs, cards, subscription/invoice objects and email addresses are synthetic. Unexpected subscription/invoice access and global fetch calls fail the tests.

## Baseline reproduced

At API main `090f988060407e343d65dfdc3387156fb7dec0a5`, nine cases execute: six pass and three fail assertions:

| Case | Observed baseline behavior | Required repair |
| --- | --- | --- |
| Successful single-card removal | DELETE returns 204, settings still report enabled; the next low-balance attempt disables only after finding no card | Disable immediately; a subsequent automatic attempt skips |
| Two tagged customers with default cards | Only the selected card is detached; the next card read returns the older customer's card; the real orchestration reaches a simulated fallback charge | Disable immediately so remaining cards cannot automatically fund a top-up |
| Settings-write failure | DELETE returns 204 without attempting a settings write | Do not report complete success when the automatic-purchase disable cannot be persisted |

The positive control reaches a simulated successful automatic charge and receipt email before removal, demonstrating that the harness can observe an unwanted charge. The six passing baseline cases cover that control, no customer, no card, non-card default, Stripe detachment failure, and an unknown credential. Every case also rejects subscription/invoice operations and checks those synthetic records remain unchanged.

Across the related billing and credits suites, 239 cases run: 236 pass and only these three regressions fail. Changed-file TypeScript, scoped ESLint, formatting and diff whitespace checks pass on the test addition. These checks do not make the three baseline regressions pass.

## Scope and policy

The multiple-customer case characterizes the existing selected-card behavior: a different customer's card remains attached and visible to GET. It deliberately does not detach every account-associated card. The account-wide promise of `card: null` / checkout-only future manual purchases remains a separate contract decision; passing the immediate auto-top-up regression alone would not settle it. The failed-detachment case does not prescribe whether auto-top-up remains off after a partially failed request.

This is local synthetic acceptance, not Stripe test-mode or authenticated production proof. It does not establish distributed concurrency behavior, already-in-flight charge cancellation, subscription renewals or invoice settlement. No payment, card, subscription, invoice or customer operation was performed against a real provider.

## Candidate review

The production repair belongs to Recoup MCP. Re-run this suite against its exact published candidate and record that SHA and result here before marking this acceptance complete. Do not merge this test-only branch with failing regressions, implement a competing repair, or treat another PR's approval as approval for this one.
