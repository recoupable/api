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

The independently authored acceptance commit `820df9cf16d3ab73fe55d6a530168d28e8ea4490` is reused in the repair branch (cherry-pick `e16f9df9`). On base main `c69768bd`, the repair passes all nine acceptance cases and all 488 cases across billing, credits and Stripe (105 files). The repair adds six focused cases; four were observed failing before implementation. Full ESLint passes. Exact published head and independent review belong in the PR/release receipt.

## Repair behavior and remaining contract decision

After authentication and finding a selected card, DELETE persists only `auto_topup_enabled: false` on the authorized account, then detaches that card. It preserves balances, amounts, thresholds and existing errors. An absent credits row needs no provisioning: the top-up reader already treats absence as disabled. A settings-write failure returns masked 500 before detachment. If Stripe then fails, DELETE returns masked 500 with top-ups left off; restoring them could re-enable unwanted automatic purchases. No-card/customer still returns 404 without changes; success remains empty 204.

This is ordered failure handling across two services, not a transaction. A charge that already read enabled settings may still complete, and a concurrent explicit settings update may turn top-ups back on. This repair does not claim cancellation or serialization of those operations.

Two account-wide policy options remain for #343:

1. Keep selected-card removal and explicitly document that another saved card can appear on GET and be used for a later explicitly confirmed manual purchase. Automatic top-ups stay off until explicitly re-enabled.
2. Introduce an account-wide credit-purchase disable/removal state, applied consistently to card reads, checkout and manual/automatic purchases, with an explicit re-enable journey. This needs a separate design for subscription/invoice funding and any migration; deleting all Stripe cards would affect those funding paths.

The public promise of unconditional `card: null` / checkout-only behavior and its missing 404/500 schemas still need a Docs contract change after that policy decision. This scoped API repair does not close all of Mono #343. No subscription, invoice, checkout or manual-purchase implementation changes are included.
